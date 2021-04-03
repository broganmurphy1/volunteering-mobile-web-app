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
  clientEmergencyContact: {
    contactName: String,
    contactTelNo: String,
    relationToClient: String
  },
  jobStatus: String
});

ClientJobSchema.index({location: "2dsphere"});

module.exports = mongoose.model("Clientjob", ClientJobSchema);
