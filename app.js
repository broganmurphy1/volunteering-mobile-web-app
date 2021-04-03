//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");
const passport = require('passport');
LocalStrategy = require("passport-local");
passportLocalMongoose = require("passport-local-mongoose");
Client = require("./models/client");
ClientJob = require("./models/clientjob");
const flash = require("connect-flash");
const session = require('express-session');
const nodeGeocoder = require('node-geocoder');
require("dotenv").config();
const methodOverride = require('method-override');

const password = process.env.PASSWORD;
const uri = "mongodb+srv://admin-brogan:"+ password +"@volunteerdb.nkpqs.mongodb.net/myFirstDatabase?retryWrites=true&w=majority&ssl=true"

mongoose.connect(uri || "mongodb://localhost:27017/VolunteerDB", {useNewUrlParser: true, useUnifiedTopology: true}).then(() => console.log('connected'))
.catch((err)=> console.log(err));

const app = express();
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method
    delete req.body._method
    return method
  }
}))

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(flash());

app.use(session({
    secret: "Rusty is a dog",
    resave: true,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
  passReqToCallback: true,
},
  (req, username, password, authCheckDone) => {
    Client.findOne({username}).then(user => {
      if(!user) {
        return authCheckDone(null, false, req.flash('error', 'Login Issue'));
      }
      if (user && user.comparePassword(password)) {
        return authCheckDone(null, user);
      }
      else {
        console.log('Invalid Password');
        return authCheckDone( null, false, req.flash('error', 'Invalid Password'));
      }
    });
  }
));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  done(null, { id });
});

const API_KEY = process.env.API_KEY;

var geocoder = nodeGeocoder({
  provider: 'opencage',
  apiKey: API_KEY
});

// ROUTES

app.get("/", function(req, res){
  res.render("start");
});

app.get("/client-login", function(req, res){
  const errors = req.flash().error || [];
  res.render("client-login", {errors});
})

app.get("/client-create-account", function(req, res){
  const errors = req.flash().error || [];
  res.render("client-create-account", {errors});
})

app.post("/client-create-account", function(req, res){

  var regex = new RegExp("((\\+44(\\s\\(0\\)\\s|\\s0\\s|\\s)?)|0)7\\d{3}(\\s)?\\d{6}");

  if (!req.body.clientFullName
    || !req.body.clientContactNumber
    || !req.body.clientAddressOne
    || !req.body.clientPostcode
    || !req.body.clientCity
    || !req.body.clientEmail
    || !req.body.clientPassword
    || !req.body.clientConfirmPassword) {
    req.flash('error', 'Please fill out all required fields');
    res.redirect("client-create-account");
  }
  else if (!regex.test(req.body.clientContactNumber)) {
    req.flash('error', 'Incorrect contact number, please try again');
    res.redirect("client-create-account");
  }
  else if(req.body.clientPassword !== req.body.clientConfirmPassword) {
    req.flash('error', "Passwords do not match, please try again");
    res.redirect("client-create-account");
  }
  else {
    Client.findOne({username: req.body.clientEmail}, function(err, user) {
      if(err) {
        console.log(err);
      }
      if(user) {
        req.flash('error', "Sorry, this email is already registered, please try another");
        res.redirect("client-create-account");
      }
      else {
        const newClient = new Client({
          clientFullName: req.body.clientFullName,
          clientContactNumber: req.body.clientContactNumber,
          clientAddressOne: req.body.clientAddressOne,
          clientPostcode: req.body.clientPostcode,
          clientAddressTwo: req.body.clientAddressTwo,
          clientCity: req.body.clientCity,
          clientMedCondition: req.body.clientMedCondition,
          clientEmergencyContact: {
            contactName: "",
            contactTelNo: "",
            relationToClient: ""
          },
          username: req.body.clientEmail,
          password: req.body.clientPassword
        });

        newClient.save(function(err) {
          if(err){
            console.log(err);
          }
          else{
            res.render('client-account-success', {newUser: req.body.clientFullName});
          }
        })
      }
    });
  }
})

app.post("/client-login", passport.authenticate('local', {
  failureFlash: true,
  failureRedirect: '/client-login'
}), (req, res, next) => {
   req.session.user = req.user;
   res.render("client-home", {user: req.user.clientFullName});
})

const ensureAuthenticated = (req, res, next) => {
  if(req.isAuthenticated()) {
    return next();
  }
  res.redirect("/client-login");
}

app.get("/client-home", ensureAuthenticated, function(req, res) {
    res.render("client-home", {user: req.session.user.clientFullName});
})

app.get('/client-logout', function(req, res){
  req.logout();
  res.redirect('/client-login');
});

app.get("/client-post-job", ensureAuthenticated, function(req, res){
  const errors = req.flash().error || [];
  res.render("client-post-job", {googlekey: process.env.GOOGLE_API_KEY, errors});
});

app.post("/client-post-job", function(req, res) {

  var postcodeRegex = new RegExp("^([A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}|GIR ?0A{2})$")

  if(req.body.clientJobPostcode && postcodeRegex.test(req.body.clientJobPostcode))
  {
    if(!req.body.clientJobCategory || !req.body.clientJobDesc) {
      req.flash('error', "Please make sure all required fields are filled in and you have specified your location correctly");
      res.redirect("client-post-job");
    }
    else {
      geocoder.geocode(req.body.clientJobPostcode + ', ' + req.body.clientJobCountry, function(err, results) {
        console.log(req.body);
        console.log(req.session.user);
        var lat = results[0].latitude;
        var lon = results[0].longitude;

        const newClientJob = new ClientJob({
          clientJobCategory: req.body.clientJobCategory,
          location: {
            type: "Point",
            coordinates: [parseFloat(lat), parseFloat(lon)]
          },
          clientJobDesc: req.body.clientJobDesc,
          clientDetails: {
            clientID: req.session.user._id,
            clientName: req.session.user.clientFullName,
            clientContactNumber: req.session.user.clientContactNumber,
            clientMedCondition: req.session.user.clientMedCondition
          },
          clientEmergencyContact: {
            contactName: req.session.user.clientEmergencyContact.contactName,
            contactTelNo: req.session.user.clientEmergencyContact.contactTelNo,
            relationToClient: req.session.user.clientEmergencyContact.relationToClient
          },
          jobStatus: "Available"
        });
        newClientJob.save(function(err) {
          if(err){
            console.log(err);
          }
          else{
            res.render("client-job-success");
            console.log(newClientJob);
          }
        })
      });
    }
  }
  else
  {
    if(!req.body.clientJobCategory || !req.body.clientJobDesc || !req.body.userCurrentLat || !req.body.userCurrentLon) {
      req.flash('error', "Please make sure all required fields are filled in and you have specified your location correctly");
      res.redirect("client-post-job");
    }
    else {
      console.log(req.body);
      console.log(req.session.user);

      var lat = req.body.userCurrentLat;
      var lon = req.body.userCurrentLon;

      const newClientJob = new ClientJob({
        clientJobCategory: req.body.clientJobCategory,
        location: {
          type: "Point",
          coordinates: [parseFloat(lat), parseFloat(lon)]
        },
        clientJobDesc: req.body.clientJobDesc,
        clientDetails: {
          clientID: req.session.user._id,
          clientName: req.session.user.clientFullName,
          clientContactNumber: req.session.user.clientContactNumber,
          clientMedCondition: req.session.user.clientMedCondition
        },
        clientEmergencyContact: {
          contactName: req.session.user.clientEmergencyContact.contactName,
          contactTelNo: req.session.user.clientEmergencyContact.contactTelNo,
          relationToClient: req.session.user.clientEmergencyContact.relationToClient
        },
        jobStatus: "Available"
      });
      newClientJob.save(function(err) {
        if(err){
          console.log(err);
        }
        else{
          res.render("client-job-success")
          console.log(newClientJob);
        }
      })
    }
  }
})

app.get("/client-job-activity", ensureAuthenticated, function(req, res){
  console.log(req.session.user);

  ClientJob.find({"clientDetails.clientID": req.session.user._id}, function(err, jobs) {
    res.render("client-job-activity", {jobs: jobs});
  })
})

app.get("/jobs/:jobId", ensureAuthenticated, function(req, res){
  const errors = req.flash().error || [];
  const requestedJobId = req.params.jobId

  console.log(requestedJobId);

  ClientJob.findOne({_id: requestedJobId}, function(err, job) {
    if(err) {
      console.log(err);
    }
    else {
      const coordinates = job.location.coordinates[0] + ', ' + job.location.coordinates[1];
      geocoder.geocode(coordinates, function(err, results) {
        console.log(results);
        res.render("job", {
          jobLocation: results[0].zipcode,
          jobDescription: job.clientJobDesc,
          jobID: job._id,
          errors
        })
      })
    }
  })
})

app.put("/jobs/:jobId", function(req, res){
  const requestedJobId = req.params.jobId;
  const split = requestedJobId.split(":");

  const splitRequestedJobId = split[1];
  console.log(splitRequestedJobId);

  ClientJob.findOne({_id: splitRequestedJobId}, function(err, job) {
    if(err) {
      console.log(err);
    }
    else {
      if(!req.body.clientJobLocation || !req.body.clientJobDesc) {
        req.flash('error', "Please make sure all required fields are filled in and you have specified your location correctly");
        res.redirect('/jobs/' + splitRequestedJobId);
      }
      else {
        geocoder.geocode(req.body.clientJobLocation + ', ' + req.body.clientJobCountry, function(err, results) {
          var lat = results[0].latitude;
          var lon = results[0].longitude;

          job.clientJobDesc = req.body.clientJobDesc;
          job.location.coordinates = [parseFloat(lat), parseFloat(lon)];
          job.save(function(err, savedJob) {
            if(err) {
              console.log(err);
            }
            else {
              console.log(savedJob);
              res.render("client-job-edit-success");
            }
          })
        });
      }
    }
  });
})

app.delete("/jobs/:jobId", function(req, res){
  const requestedJobId = req.params.jobId;
  const split = requestedJobId.split(":");

  const splitRequestedJobId = split[1];
  console.log(splitRequestedJobId);

  ClientJob.deleteOne({_id: splitRequestedJobId}, function(err) {
    if(err) {
      console.log(err);
    }
    else{
      res.render("client-job-delete-success");
    }
  });
})

app.get("/client-contact-details", ensureAuthenticated, function(req, res){
  const errors = req.flash().error || [];
  console.log(req.session.user);

  Client.find({_id: req.session.user._id}, function(err, clients) {
    if(err) {
      console.log(err);
    }
    else {
      console.log(clients[0].clientEmergencyContact);
      res.render("client-contact-details", {clients: clients, errors});
    }
  });
})

app.put("/client-contact-details", function(req, res){

  var regex = new RegExp("((\\+44(\\s\\(0\\)\\s|\\s0\\s|\\s)?)|0)7\\d{3}(\\s)?\\d{6}");

  Client.findOne({_id: req.session.user._id}, function(err, client) {
    if(err) {
      console.log(err);
    }
    else {
      if(!req.body.emergencyContactName || !req.body.emergencyContactTelNo || !req.body.emergencyContactRelation) {
        req.flash('error', "Please make sure all required fields are filled in");
        res.redirect('/client-contact-details');
      }
      else if(!regex.test(req.body.emergencyContactTelNo)) {
        req.flash('error', "Incorrect telephone number, please try again");
        res.redirect('/client-contact-details');
      }
      else {
        client.clientEmergencyContact.contactName = req.body.emergencyContactName;
        client.clientEmergencyContact.contactTelNo = req.body.emergencyContactTelNo;
        client.clientEmergencyContact.relationToClient = req.body.emergencyContactRelation;
        client.save(function(err, updatedClient) {
          if(err) {
            console.log(err);
          }
          else {
            console.log(updatedClient);
            res.redirect("client-contact-details");
          }
        })
      }
    }
  });
})

app.get("/client-emergency-contact-details/:clientId", ensureAuthenticated ,function(req, res){
  const errors = req.flash().error || [];
  const requestedClientId = req.params.clientId

  console.log(requestedClientId);

  Client.findOne({_id: requestedClientId}, function(err, client) {
    if(err) {
      console.log(err);
    }
    else {
      res.render("client-contact", {
        clientContactName: client.clientEmergencyContact.contactName,
        clientContactTelNo: client.clientEmergencyContact.contactTelNo,
        clientContactRelation: client.clientEmergencyContact.relationToClient,
        clientID: client._id,
        errors
      })
    }
  })
})

app.put("/client-emergency-contact-details/:clientId", function(req, res){
  var regex = new RegExp("((\\+44(\\s\\(0\\)\\s|\\s0\\s|\\s)?)|0)7\\d{3}(\\s)?\\d{6}");
  const requestedClientId = req.params.clientId;
  const split = requestedClientId.split(":");

  const splitRequestedClientId = split[1];
  console.log(splitRequestedClientId);

  Client.findOne({_id: splitRequestedClientId}, function(err, client) {
    if(err) {
      console.log(err);
    }
    else {
      if(!req.body.emergencyContactName|| !req.body.emergencyContactTelNo || !req.body.emergencyContactRelation) {
        req.flash('error', "Please make sure all required fields are filled in");
        res.redirect('/client-emergency-contact-details/' + splitRequestedClientId);
      }
      else if(!regex.test(req.body.emergencyContactTelNo)) {
        req.flash('error', "Incorrect telephone number, please try again");
        res.redirect('/client-emergency-contact-details/' + splitRequestedClientId);
      }
      else {
        client.clientEmergencyContact.contactName = req.body.emergencyContactName;
        client.clientEmergencyContact.contactTelNo = req.body.emergencyContactTelNo;
        client.clientEmergencyContact.relationToClient = req.body.emergencyContactRelation;
        client.save(function(err, savedClientContactDetails) {
          if(err) {
            console.log(err);
          }
          else {
            console.log(savedClientContactDetails);
            res.render("client-edit-contact-success");
          }
        })
      }
    }
  });
})

app.delete("/client-emergency-contact-details/:clientId", function(req, res){
  const requestedClientId = req.params.clientId;
  const split = requestedClientId.split(":");

  const splitRequestedClientId = split[1];
  console.log(splitRequestedClientId);

  Client.findOneAndUpdate({_id: splitRequestedClientId}, {"$set":{"clientEmergencyContact.contactName": req.body.blankContactName, "clientEmergencyContact.contactTelNo": req.body.blankContactTelNo, "clientEmergencyContact.relationToClient": req.body.blankContactRelation}}, function(err, result) {
    if(err) {
      console.log(err);
    }
    else{
      res.render('client-delete-contact-success');
      console.log(result);
    }
  });
})

app.get("/client-help-guide", ensureAuthenticated, function(req, res){
  res.render("client-help-guide");
})

app.get("/client-help-guide/post-job", ensureAuthenticated, function(req, res){
  res.render("client-hg-post-job");
})

app.get("/client-help-guide/view-job", ensureAuthenticated, function(req, res) {
  res.render("client-hg-view-job");
})

app.get("/client-help-guide/edit-job", ensureAuthenticated, function(req, res) {
  res.render("client-hg-edit-job");
})

app.get("/client-help-guide/delete-job", ensureAuthenticated, function(req, res) {
  res.render("client-hg-delete-job");
})

app.get("/client-help-guide/add-contact-details", ensureAuthenticated, function(req, res) {
  res.render("client-hg-add-contact-details");
})

app.get("/client-help-guide/edit-contact-details", ensureAuthenticated, function(req, res) {
  res.render("client-hg-edit-contact-details");
})

app.get("/client-help-guide/delete-contact-details", ensureAuthenticated, function(req, res) {
  res.render("client-hg-delete-contact-details");
})


app.listen(process.env.PORT || 3000, function(){
  console.log("Server started on port 3000");
})
