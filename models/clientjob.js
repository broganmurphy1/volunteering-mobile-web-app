const mongoose = require("mongoose");

const ClientJobSchema = new mongoose.Schema({
  clientJobCategory: String,
  location: {
    type: {type: String},
    coordinates: []
  },
  clientJobDesc: String,
  clientDetails: {
    clientID: String,
    clientName: String,
    clientContactNumber: String,
    clientMedCondition: String
  },
  //timePosted:{ type : Date, default: Date.now }
});

ClientJobSchema.index({location: "2dsphere"});

module.exports = mongoose.model("Clientjob", ClientJobSchema);
