'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
const dns = require('dns');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true});
let db = mongoose.connection;
db.on("error", err => console.error("connection error"));

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
let bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

// MondoDB Schema and Model
let urlSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true
  },
  short_url: {
    type: Number
  }
});

let urlModel = mongoose.model("URL Pair", urlSchema);

// Handle API route
app.post("/api/shorturl/new", function (req, res) {
  let userUrl = req.body.url;
  let myRegex = /^https?:\/\//;
  
  // First test if url points to a valid server
  dns.lookup(userUrl.replace(myRegex, ""), (err) => {
    if (err) return res.json({
      error: "invalid URL"
    });
    
    // If simple test passes, look for long url in DB
    urlModel.findOne({original_url: userUrl}, (err, pair) => {
      if (err) return console.error(err);
      
      // If not found, create a new entry in DB
      if (pair === null) {
        // Search for entries in DB to get short_url
        return urlModel.find()
          .select("short_url")
          // Sort descending to get greatest number first
          .sort("-short_url")
          .exec((err, docs) => {
            // If this is the first item in the DB
            if (docs.length === 0) {
              let newPair = new urlModel({
                original_url: userUrl,
                short_url: 1
              });
              
              return newPair.save((err, thisDoc) => {
                if (err) return console.error(err);
                res.json({
                  original_url: thisDoc.original_url,
                  short_url: thisDoc.short_url
                });
              });          
            }
            
            let newPair = new urlModel({
              original_url: userUrl,
              short_url: docs[0].short_url + 1
            });
        
            return newPair.save((err, thisDoc) => {
              if (err) return console.error(err);
              res.json({
                original_url: thisDoc.original_url,
                short_url: thisDoc.short_url
              });
            });
          });
      }
      
      // Return JSON object for original_url already in DB
      return res.json({
        original_url: pair.original_url,
        short_url: pair.short_url
      });
    });
  });
});

// Redirect short_url to original_url
app.get("/api/shorturl/:shortUrl", (req, res) => {
  urlModel.findOne({short_url: req.params.shortUrl}, (err, data) => {
    let shorty = data.original_url;
    res.redirect(shorty);
  });
});


app.listen(port, function () {
  console.log('Node.js listening ...');
});