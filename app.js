//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");
const saltRounds = 10;
const passport = require('passport');
LocalStrategy = require("passport-local");
passportLocalMongoose = require("passport-local-mongoose");
Client = require("./models/client");
ClientJob = require("./models/clientjob");
const flash = require("connect-flash");
const session = require('express-session');
const nodeGeocoder = require('node-geocoder');
require("dotenv").config()

mongoose.connect("mongodb://localhost:27017/VolunteerDB", {useNewUrlParser: true, useUnifiedTopology: true}).then(() => console.log('connected'))
.catch((err)=> console.log(err));

const app = express();
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
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

var geocoder = nodeGeocoder({
  provider: 'opencage',
  apiKey: process.env.API_KEY
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
          }
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
          clientName: req.session.user.clientFullName,
          clientContactNumber: req.session.user.clientContactNumber,
          clientMedCondition: req.session.user.clientMedCondition
        }
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

app.listen(3000, function(){
  console.log("Server started on port 3000");
})
