var config = {};

config.debug = process.env.DEBUG || false;

config.mqtt  = {};
config.mqtt.namespace = process.env.MQTT_NAMESPACE || '#';
config.mqtt.hostname  = process.env.MQTT_HOSTNAME  || 'server2.cmeriiot.internal';
config.mqtt.port      = process.env.MQTT_PORT      || 8883;

config.mongodb = {};
config.mongodb.hostname   = process.env.MONGODB_HOSTNAME   || 'server1.cmeriiot.internal';
config.mongodb.port       = process.env.MONGODB_PORT       || 27017;
config.mongodb.database   = process.env.MONGODB_DATABASE   || 'tree';
config.mongodb.collection = process.env.MONGODB_COLLECTION || 'message';

module.exports = config;
