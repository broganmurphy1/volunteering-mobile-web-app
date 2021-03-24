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
const flash = require("connect-flash");
const session = require('express-session');

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

// ROUTES

app.get("/", function(req, res){
  res.render("start");
});

app.get("/client-login", function(req, res){
  const errors = req.flash().error || [];
  res.render("client-login", {errors});
})

app.get("/client-create-account", function(req, res){
  res.render("client-create-account");
})

app.post("/client-create-account", function(req, res){
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
})

app.post("/client-login", passport.authenticate('local', {
  failureFlash: true,
  failureRedirect: '/client-login'
}), (req, res, next) => {
   req.session.user = req.user;
   console.log(req.session.user);
   res.render("client-home", {user: req.user.clientFullName});
})

const ensureAuthenticated = (req, res, next) => {
  if(req.isAuthenticated()) {
    return next();
  }
  res.redirect("/client-login");
}

app.get("/client-home", ensureAuthenticated, function(req, res) {

  if(ensureAuthenticated)
  {
    res.render("client-home", {user: req.session.user.clientFullName});
  }
})

app.get('/client-logout', function(req, res){
  req.logout();
  res.redirect('/');
});


app.listen(3000, function(){
  console.log("Server started on port 3000");
})
