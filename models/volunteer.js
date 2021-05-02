const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

var hash_password = function( password ) {
    let salt = bcrypt.genSaltSync(10); // enter number of rounds, default: 10
    let hash = bcrypt.hashSync( password, salt );
    return hash;
};

const VolunteerSchema = new mongoose.Schema({
  volunteerFullName: String,
  volunteerContactNumber: String,
  username: String,
  password: String
});

VolunteerSchema.methods.comparePassword = function(password) {
    if ( ! this.password ) { return false; }
    return bcrypt.compareSync( password, this.password );
};

VolunteerSchema.pre('save', function(next) {
    // check if password is present and is modified.
    if ( this.password && this.isModified('password') ) {
        this.password = hash_password(this.password);
    }
    next();
});


module.exports = mongoose.model("Volunteer", VolunteerSchema);
