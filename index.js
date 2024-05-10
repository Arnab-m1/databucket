const fs = require('fs');
const mqtt = require('mqtt');
const path = require('path');
const config = require('./config');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: './logs/logfile.log' })
    ]    
});

let KEY, CERT, CAFile;

try {
    KEY = fs.readFileSync(path.join(__dirname, '/cert/server.key'));
} catch (error) {
    if (error.code === 'ENOENT') {
        console.log("KEY File not Found!");
    } else {
        throw error;
    }
}

try {
    CERT = fs.readFileSync(path.join(__dirname, '/cert/server.crt'));
} catch (error) {
    if (error.code === 'ENOENT') {
        console.log("CERT File not Found!");
    } else {
        throw error;
    }
}

try {
    CAFile = [fs.readFileSync(path.join(__dirname, '/cert/my-ca.crt'))];
} catch (error) {
    if (error.code === 'ENOENT') {
        console.log("CA File not Found!");
    } else {
        throw error;
    }
}

const options = {
    clientId: 'CSIR-CMERI_Data_Saver1',
    host: config.mqtt.hostname,
    port: config.mqtt.port,
    protocol: 'mqtts',
    protocolId: 'MQTT',
    ca: CAFile,
    key: KEY,
    cert: CERT,
    protocolVersion: 4,
    ciphers: 'ALL',
    rejectUnauthorized: false
};

const mongoUri = 'mongodb://server1.cmeriiot.internal:27017/?tls=true';
const mongoOptions = {
    tls: true, // Enable TLS, replacing sslValidate
    tlsAllowInvalidCertificates: true,
    tlsCertificateKeyFile: path.join(__dirname, '/cert/mongodb12.pem'),
    tlsCAFile: path.join(__dirname, '/cert/my-ca.crt'),
};

let mongoClient;
let deviceCodes = new Set();  // to store device codes

async function initializeMongoClient() {
    mongoClient = new MongoClient(mongoUri, mongoOptions,  { minPoolSize: 2, maxPoolSize: 10 });
    await mongoClient.connect();
    console.log("Connected to MongoDB with connection pooling!");
    fetchDeviceCodes();  // Fetch device codes upon initialization
}

async function fetchDeviceCodes() {
    const username = 'admin';
    const password = 'password';
    const authString = Buffer.from(`${username}:${password}`).toString('base64');

    const config = {
        headers: {
            Authorization: `Basic ${authString}`
        }
    };

    try {
        const response = await axios.get('https://iot.cmeri.res.in:8000/api/v1/iotendpoints', config);
        deviceCodes = new Set(response.data.map(device => device.device_code));  // store device codes in a Set for quick lookup
        console.log("Device codes fetched and updated.");
    } catch (error) {
        console.error('Failed to fetch device codes:', error);
    }
}


initializeMongoClient().catch(err => {
    console.error('Failed to initialize MongoDB client:', err);
    process.exit(1);
});

const client = mqtt.connect(options);

client.on('connect', function () {
    client.subscribe(config.mqtt.namespace, { qos: 2 });
    console.log("Subscribed to namespace:", config.mqtt.namespace);
});

client.on('message', async function (topic, message) {
    // Verify topic exists in device codes before processing
    if (!deviceCodes.has(topic)) {
        console.log(`Topic ${topic} is not valid according to device codes. Ignoring message.`);
        logger.log('info', `Topic ${topic} is not valid according to device codes. Ignoring message.`);
        return;
    }

    const data = {
        topic: topic,
        dataSize: Buffer.byteLength(message, 'utf8'),
        timestamp: new Date()
    };

    let rcvdMsg;
    try {
        rcvdMsg = JSON.parse(message.toString());
    } catch (e) {
        console.log(message.toString() + " invalid JSON format");
        return;
    }

    try {
        const db1 = mongoClient.db('CSIR_IoT_(Water_Service_Delivery_Measurement_and_Monitoring)');
        const collection1 = db1.collection(topic);
        await collection1.insertOne(rcvdMsg);
        console.log("Inserted into CSIR_IoT_(Water_Service_Delivery_Measurement_and_Monitoring):", rcvdMsg);
        logger.log('info', 'Inserted into CSIR_IoT_(Water_Service_Delivery_Measurement_and_Monitoring):', rcvdMsg);

        const db2 = mongoClient.db('CSIR_IoT_Calculator');
        const collection2 = db2.collection(topic);
        await collection2.insertOne(data);
        console.log("Inserted into CSIR_IoT_Calculator:", data);
        logger.log('info', 'Inserted into CSIR_IoT_Calculator:', data);
    } catch (error) {
        console.error('Error inserting data:', error);
        logger.error('Error inserting data:', error);
    }
});

// Periodically update device codes
setInterval(fetchDeviceCodes, 1800000); // Update device codes every hour
