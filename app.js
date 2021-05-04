//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const passport = require('passport');
LocalStrategy = require("passport-local");
passportLocalMongoose = require("passport-local-mongoose");
Client = require("./models/client");
ClientJob = require("./models/clientjob");
Volunteer = require("./models/volunteer");
const flash = require("connect-flash");
const session = require('express-session');
const nodeGeocoder = require('node-geocoder');
require("dotenv").config();
const methodOverride = require('method-override');
const nodemailer = require('nodemailer');

const password = process.env.PASSWORD;
const uri = "mongodb://admin-brogan:"+ password +"@volunteerdb-shard-00-00.nkpqs.mongodb.net:27017,volunteerdb-shard-00-01.nkpqs.mongodb.net:27017,volunteerdb-shard-00-02.nkpqs.mongodb.net:27017/myFirstDatabase?ssl=true&replicaSet=atlas-k631wp-shard-0&authSource=admin&retryWrites=true&w=majority"

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

passport.use('client-login', new LocalStrategy({
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

//Volunteer Login Local Strategy
passport.use('volunteer-login', new LocalStrategy({
  passReqToCallback: true,
},
  (req, username, password, authCheckDone) => {
    Volunteer.findOne({username}).then(user => {
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

const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

var transporter = nodemailer.createTransport({
  service: '"Outlook365"',
  auth: {
    user: 'broganmurphy1@live.co.uk',
    pass: EMAIL_PASSWORD
  }
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
  var emailRegex = new RegExp("^\\w+([-+.']\\w+)*@\\w+([-.]\\w+)*\\.\\w+([-.]\\w+)*$");

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
  else if (!emailRegex.test(req.body.clientEmail)) {
    req.flash('error', 'Incorrect email address format, please try again');
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

app.post("/client-login", passport.authenticate('client-login', {
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
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
  res.render("client-post-job", {googlekey: GOOGLE_API_KEY, errors});
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
        console.log(results[0]);

        const newClientJob = new ClientJob({
          clientJobCategory: req.body.clientJobCategory,
          location: {
            type: "Point",
            coordinates: [parseFloat(lat), parseFloat(lon)],
          },
          clientJobDesc: req.body.clientJobDesc,
          clientDetails: {
            clientID: req.session.user._id,
            clientName: req.session.user.clientFullName,
            clientEmailAddress: req.session.user.username,
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
          clientEmailAddress: req.session.user.username,
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

  var postcodeRegex = new RegExp("^([A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}|GIR ?0A{2})$")

  ClientJob.findOne({_id: splitRequestedJobId}, function(err, job) {
    if(err) {
      console.log(err);
    }
    else {
      if(!req.body.clientJobLocation || !req.body.clientJobDesc || !postcodeRegex.test(req.body.clientJobLocation)) {
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
            req.session.user.clientEmergencyContact.contactName = req.body.emergencyContactName;
            req.session.user.clientEmergencyContact.contactTelNo = req.body.emergencyContactTelNo;
            req.session.user.clientEmergencyContact.relationToClient = req.body.emergencyContactRelation;
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
            req.session.user.clientEmergencyContact.contactName = req.body.emergencyContactName;
            req.session.user.clientEmergencyContact.contactTelNo = req.body.emergencyContactTelNo;
            req.session.user.clientEmergencyContact.relationToClient = req.body.emergencyContactRelation;
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
      req.session.user.clientEmergencyContact.contactName = '';
      req.session.user.clientEmergencyContact.contactTelNo = '';
      req.session.user.clientEmergencyContact.relationToClient = '';
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

//Volunteer ROUTES

app.get("/volunteer-login", function(req, res){
  const errors = req.flash().error || [];
  res.render("volunteer-login", {errors});
})

app.get("/volunteer-create-account", function(req, res){
  const errors = req.flash().error || [];
  res.render("volunteer-create-account", {errors});
})

app.post("/volunteer-create-account", function(req, res){

  var regex = new RegExp("((\\+44(\\s\\(0\\)\\s|\\s0\\s|\\s)?)|0)7\\d{3}(\\s)?\\d{6}");
  var emailRegex = new RegExp("^\\w+([-+.']\\w+)*@\\w+([-.]\\w+)*\\.\\w+([-.]\\w+)*$");

  if (!req.body.volunteerFullName
    || !req.body.volunteerContactNumber
    || !req.body.volunteerEmail
    || !req.body.volunteerPassword
    || !req.body.volunteerConfirmPassword) {
    req.flash('error', 'Please fill out all required fields');
    res.redirect("volunteer-create-account");
  }
  else if (!regex.test(req.body.volunteerContactNumber)) {
    req.flash('error', 'Incorrect contact number, please try again');
    res.redirect("volunteer-create-account");
  }
  else if (!emailRegex.test(req.body.volunteerEmail)) {
    req.flash('error', 'Incorrect email address format, please try again');
    res.redirect("volunteer-create-account");
  }
  else if(req.body.volunteerPassword !== req.body.volunteerConfirmPassword) {
    req.flash('error', "Passwords do not match, please try again");
    res.redirect("volunteer-create-account");
  }
  else {
    Volunteer.findOne({username: req.body.volunteerEmail}, function(err, user) {
      if(err) {
        console.log(err);
      }
      if(user) {
        req.flash('error', "Sorry, this email is already registered, please try another");
        res.redirect("volunteer-create-account");
      }
      else {
        const newVolunteer = new Volunteer({
          volunteerFullName: req.body.volunteerFullName,
          volunteerContactNumber: req.body.volunteerContactNumber,
          username: req.body.volunteerEmail,
          password: req.body.volunteerPassword
        });

        newVolunteer.save(function(err) {
          if(err){
            console.log(err);
          }
          else{
            res.render("volunteer-create-account-success", {newUser: req.body.volunteerFullName});
          }
        })
      }
    });
  }
})

app.post("/volunteer-login", passport.authenticate('volunteer-login', {
  failureFlash: true,
  failureRedirect: '/volunteer-login'
}), (req, res, next) => {
   req.session.user = req.user;
   console.log("ok");
   console.log(req.session.user);
   res.render("volunteer-home", {user: req.user.volunteerFullName});
})

const ensureVolunteerAuthenticated = (req, res, next) => {
  if(req.isAuthenticated()) {
    return next();
  }
  res.redirect("/volunteer-login");
}

app.get("/volunteer-home", ensureVolunteerAuthenticated, function(req, res) {
    res.render("volunteer-home", {user: req.session.user.volunteerFullName});
    console.log(req.session.user);
})

app.get("/volunteer-get-postcode", ensureVolunteerAuthenticated, function(req, res) {
  const errors = req.flash().error || [];
  res.render("volunteer-get-postcode", {errors});
})

app.post("/volunteer-get-postcode", ensureVolunteerAuthenticated, function(req, res) {
  console.log(req.body.volunteerJobPostcode);

  var postcodeRegex = new RegExp("^([A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}|GIR ?0A{2})$");
  geocoder.geocode(req.body.volunteerJobPostcode, function(err, results) {

  if(!req.body.volunteerJobPostcode || !postcodeRegex.test(req.body.volunteerJobPostcode)) {
    req.flash('error', "Invalid Postcode");
    res.redirect("volunteer-get-postcode");
  }
  else if (!results || results[0].country !== 'United Kingdom') {
    req.flash('error', "Invalid Postcode");
    res.redirect("volunteer-get-postcode");
  }
  else{
      console.log(results);
      var lat = results[0].latitude;
      var lon = results[0].longitude;
      console.log(lat);
      console.log(lon);
        ClientJob.find({location: {$near: {$geometry: {type: "Point", coordinates: [lat, lon]}, $minDistance: 0, $maxDistance: 40233}}}, function(err, jobs) {
            var availableJobs = jobs.filter(job => job.jobStatus === "Available" && req.session.user.volunteerNotInterested.some(category => job.clientJobCategory.includes(category)) == false);
            console.log(availableJobs);
            res.render("volunteer-view-jobs", {jobs: availableJobs})
        });
      }
    })
})

app.get("/volunteerjobs/:jobId", ensureVolunteerAuthenticated, function(req, res){
  const errors = req.flash().error || [];
  const requestedJobId = req.params.jobId
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
  console.log(requestedJobId);

  ClientJob.findOne({_id: requestedJobId}, function(err, job) {
    if(err) {
      console.log(err);
    }
    else {
      const coordinates = job.location.coordinates[0] + ', ' + job.location.coordinates[1];
      geocoder.geocode(coordinates, function(err, results) {
        console.log(results);
        res.render("volunteerjob", {
          jobLat: job.location.coordinates[0],
          jobLon: job.location.coordinates[1],
          jobCategory: job.clientJobCategory,
          jobLocation: results[0].zipcode,
          jobDescription: job.clientJobDesc,
          jobID: job._id,
          googlekey: GOOGLE_API_KEY
        })
      })
    }
  })
})

app.put("/volunteerjobs/:jobId", function(req, res){
  const requestedJobId = req.params.jobId;
  const split = requestedJobId.split(":");

  const splitRequestedJobId = split[1];
  console.log(splitRequestedJobId);
  console.log(req.session.user.username);

  ClientJob.findOne({_id: splitRequestedJobId}, function(err, job) {
    if(err) {
      console.log(err);
    }
    else {
        job.jobStatus = "Accepted"
        job.save(function(err, savedJob) {
          if(err) {
            console.log(err);
          }
          else {
            console.log(savedJob);
            var emailToClient = {
              from: 'broganmurphy1@live.co.uk',
              to: job.clientDetails.clientEmailAddress,
              subject: 'Your job has been accepted.',
              text: 'Your Job for ' + job.clientJobCategory + ' has been accepted. Description: '
              + job.clientJobDesc + "\nYour volunteer is: "
              + req.session.user.volunteerFullName + "\n Their number is: " + req.session.user.volunteerContactNumber
              + "\nTheir email address is: " + req.session.user.username
            };

            transporter.sendMail(emailToClient, function(error, info){
              if (error) {
                console.log(error);
              } else {
                console.log('Email sent: ' + info.response);
              }
            });
            res.render("volunteer-accept-job-success");
          }
      })
      var confirmationEmail = {
        from: 'broganmurphy1@live.co.uk',
        to: req.session.user.username,
        subject: 'You have accepted a job',
        text: 'You have accepted the job ' + job.clientJobCategory + ': ' + job.clientJobDesc
        + '\nThe client will be in touch with you.'
      };

      transporter.sendMail(confirmationEmail, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
    }
  });
})

app.put("/volunteernotinterested/:jobId", function(req, res){
  const requestedJobId = req.params.jobId;
  const split = requestedJobId.split(":");

  const splitRequestedJobId = split[1];
  console.log(splitRequestedJobId);


  ClientJob.findOne({_id: splitRequestedJobId}, function(err, job) {
    if(err) {
      console.log(err);
    }
    else {
      var category = job.clientJobCategory;
      Volunteer.findOne({_id: req.session.user._id}, function(err, volunteer) {
        if(err){
          console.log(err)
        }
        else {
          volunteer.volunteerNotInterested.push(category);
          console.log(req.session.user);
          req.session.user.volunteerNotInterested.push(category);
          console.log(req.session.user);
          volunteer.save(function(err, updatedVolunteer){
            if(err) {
              console.log(err);
            }
            else {
              console.log(updatedVolunteer);
              const errors = req.flash().error || [];
              res.render("volunteer-home");
            }
          });
        }
      })
    }
  });
})

app.get('/volunteer-logout', function(req, res){
  req.logout();
  res.redirect('/volunteer-login');
});

app.listen(process.env.PORT || 3000, function(){
  console.log("Server started on port 3000");
})
