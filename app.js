//jshint esversion:6

// requiring the various dependencies 

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");


const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Hare Krishna.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema ({
    username: {
        type: String,
        required: true
    },
    email: String, 
    password: String,
    googleId: String,
    date: [Date],
    weight: [Number]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
let year = new Date().getFullYear();

// displaying the username of the user on the webpage
let userName = "";

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/track",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    userName = profile.displayName;
    User.findOrCreate({ username: profile.displayName, googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));



app.get("/", function(req, res) {
    res.render("home", {year: year});
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));


app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/login", function(req, res) {
    res.render("login");
});

let dataAdded = 0;

app.get("/track", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("track", {userName: userName, dataAdded: dataAdded});
    }
    else {
        res.redirect("login");
    }
    dataAdded = 0;
});

app.get("/auth/google/track", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect('/track');
  }
);

app.get("/logout", function(req, res) {
    req.logout(function(err) {
        if (err) console.log(err);
    });
    res.redirect("/");
});

let numberOfDays = 7;
let dataArray = [];
let xValues = [];
let yValues = [];
let totalChange = 0;

app.get("/progress", function(req, res) {
    res.render("progress", {totalChange: totalChange, numberOfDays: numberOfDays, xValues: JSON.stringify(xValues), yValues: JSON.stringify(yValues)});
})

app.post("/track", function(req, res) {
    console.log(req.user.id);

    let dateEntry = req.body.date;
    let weightEntry = req.body.weight;

    console.log(dateEntry);
    console.log(weightEntry);

    let id = req.user.id;
    
    let whichButton = req.body.btn;

    if (whichButton === "firstButton") {
        // finding the corresponding user and adding the entries
        // into its database

        User.findById(id, function(err, foundUser) {
            if (err) {
                console.log(err);
            }
            else {
                if (foundUser) {
                    foundUser.date.push(dateEntry);
                    foundUser.weight.push(weightEntry);
                    foundUser.save();
                    dataAdded = 1;
                }
            }
        });
        res.redirect("/track");
    }
    else if (whichButton === "secondButton") {
        User.findById(id, function(err, foundUser) {
            if (err) {
                console.log(err);
            }
            else {
                if (foundUser) {
                    let dateArray = foundUser.date;
                    let weightArray = foundUser.weight;
  
                    dataArray = [];

                    for (let i = 0; i < dateArray.length; i ++) {
                        dataArray.push({date: dateArray[i], particularWeight: weightArray[i]});
                    }

                    dataArray.sort(function(x, y) {
                        return new Date(y.date) - new Date(x.date);
                    })

                    totalChange = dataArray[0].particularWeight - dataArray[dataArray.length - 1].particularWeight;
                    numberOfDays = Number(req.body.duration);

                    let n = 0;
                    if (dataArray.length < numberOfDays) n = dataArray.length;
                    else n = numberOfDays;

                    xValues = [];
                    yValues = [];
                
                    for (var i = 0; i < n; i ++) { 
                        xValues.push(dataArray[i].date);
                        yValues.push(dataArray[i].particularWeight);
                    }
                
                    xValues.reverse();
                    yValues.reverse();

                    let tempXValues = [];
                    tempXValues = xValues;
            
                    xValues = [];
            
                    for (var i = 0; i < tempXValues.length; i ++) {
                        xValues.push(tempXValues[i].toString().substring(0, 10).substring(4));
                    }

                    res.redirect("/progress");

                }
            }
        });
    };

});


app.listen(3000, function(req, res) {
    console.log("Server successfully running at local host port number 3000");
});

