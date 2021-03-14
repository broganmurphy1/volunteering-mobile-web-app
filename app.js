//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');


const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(bodyParser.json());


app.get("/", function(req, res){
  res.render("start");
});

app.get("/client-login", function(req, res){
  res.render("client-login")
})

app.get("/client-create-account", function(req, res){
  res.render("client-create-account")
})

app.listen(3000, function(){
  console.log("Server started on port 3000");
});
