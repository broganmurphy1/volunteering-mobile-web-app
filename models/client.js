const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

var hash_password = function( password ) {
    let salt = bcrypt.genSaltSync(10); // enter number of rounds, default: 10
    let hash = bcrypt.hashSync( password, salt );
    return hash;
};

const ClientSchema = new mongoose.Schema({
  clientFullName: String,
  clientContactNumber: String,
  clientAddressOne: String,
  clientPostcode: String,
  clientAddressTwo: String,
  clientCity: String,
  clientMedCondition: String,
  clientEmergencyContact: {
    contactName: String,
    contactTelNo: String,
    relationToClient: String
  },
  username: String,
  password: String
});

ClientSchema.methods.comparePassword = function(password) {
    if ( ! this.password ) { return false; }
    return bcrypt.compareSync( password, this.password );
};

ClientSchema.pre('save', function(next) {
    // check if password is present and is modified.
    if ( this.password && this.isModified('password') ) {
        this.password = hash_password(this.password);
    }
    next();
});


module.exports = mongoose.model("Client", ClientSchema);
