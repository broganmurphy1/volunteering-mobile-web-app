const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const ClientSchema = new Schema({
  clientFullName: String,
  clientContactNumber: String,
  clientAddressOne: String,
  clientPostcode: String,
  clientAddressTwo: String,
  clientCity: String,
  clientMedCondition: String,
  username: String,
  password: String
});

module.exports = mongoose.model("Client", ClientSchema);
