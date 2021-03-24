const mongoose = require("mongoose");
const passportlocalmongoose = require("passport-local-mongoose");


var Client = mongoose.Schema({
  clientFullName: String,
  clientContactNumber: String,
  clientAddressOne: String,
  clientPostcode: String,
  clientAddressTwo: String,
  clientCity: String,
  clientMedCondition: String,
  clientEmail: String,
  clientPassword: String
});

Client.plugin(passportlocalmongoose);
module.exports = mongoose.model("Client", Client);
