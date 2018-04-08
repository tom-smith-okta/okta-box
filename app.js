// Okta + Box Platform integration

////////////////////////////////////////////////////

require('dotenv').config()

var bodyParser = require('body-parser');

var BoxSDK = require('box-node-sdk');

const express = require('express');

var fs = require('fs');

var http = require("https");

var nJwt = require('njwt');

var util = require('util');

var request = require('request');

var jsonParser = bodyParser.json()

///////////////////////////////////////////////////

// SET UP WEB SERVER
const app = express();

var port = process.env.PORT || 3000;

app.use(express.static('public'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.listen(port, function () {
	console.log('App listening on port ' + port + '...');
})


// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

//////////////////////////////////////////////////

// SET UP BOX SDK

// Look to see if the key has already been loaded into the
// environment - through heroku config vars for example
// If not, then load the key from a local file
if (!(process.env.BOX_PRIVATE_KEY)) {
	process.env.BOX_PRIVATE_KEY = fs.readFileSync('boxKey.pem', 'utf8')
}

var sdk = new BoxSDK({
	clientID: process.env.BOX_CLIENT_ID,
	clientSecret: process.env.BOX_CLIENT_SECRET,

	appAuth: {
		keyID: process.env.BOX_PUBLIC_KEY_ID,
		privateKey: process.env.BOX_PRIVATE_KEY,
		passphrase: process.env.BOX_PASSPHRASE
	}
})

//////////////////////////////////////////////////

// HOME PAGE
app.get('/', function (req, res) {
	fs.readFile('html/index.html', (err, data) => {
		if (err) {
			console.log("error reading the index.html file")
		}

		var page = data.toString()

		page = page.replace(/{{baseUrl}}/g, "https://" + process.env.OKTA_TENANT)
		page = page.replace(/{{clientId}}/g, process.env.OKTA_CLIENT_ID)
		page = page.replace(/{{OKTA_MFA_CLIENT_ID}}/g, process.env.OKTA_MFA_CLIENT_ID)
		page = page.replace(/{{OKTA_REDIRECT_URI}}/g, process.env.OKTA_REDIRECT_URI)
		page = page.replace(/{{logo}}/g, process.env.OKTA_LOGO)

		res.send(page)
	})
})

app.get('/checkAsset', function (req, res) {

	var assetID = req.query.assetID

	console.log("the assetID is: " + assetID)

	// perform a check here to see if the asset id requires MFA.
	// for this demo we are going to assume "yes"

	var state = "assetID_" + assetID

	var claims = {
		"iss": process.env.OKTA_MFA_CLIENT_ID,
		"exp": null,
		"aud": "https://" + process.env.OKTA_TENANT,
		"sub": "",
		"response_type": "id_token",
		"response_mode": "fragment",
		"client_id": process.env.OKTA_MFA_CLIENT_ID,
		"redirect_uri": process.env.OKTA_REDIRECT_URI,
		"scope": "openid",
		"acr_values": "urn:okta:app:mfa:attestation",
		"state": state,
		"nonce": "h3lX29$sWGxK3", // This should be generated dynamically
		"login_hint": process.env.OKTA_MFA_USER
	}

	var jwt = nJwt.create(claims, process.env.OKTA_MFA_CLIENT_SECRET)

	jwt.setExpiration(new Date().getTime() + (30*1000)) // thirty seconds from now

	console.log(jwt)

	var token = jwt.compact()
	console.log(token)

	var url = "https://" + process.env.OKTA_TENANT + "/oauth2/v1/authorize?request=" + token

	console.log("\nthe redirect URL is:\n" + url + "\n")

	res.redirect(url)
})

app.post('/getAsset', function(req, res) {

	var options = {
		method: 'POST',
		url: 'https://' + process.env.OKTA_TENANT + '/oauth2/v1/introspect',
		qs: {
			token: req.body.id_token,
			token_type_hint: 'id_token',
			client_id: process.env.OKTA_MFA_CLIENT_ID,
			client_secret: process.env.OKTA_MFA_CLIENT_SECRET
		},
		headers: {
			'Cache-Control': 'no-cache',
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		}
	}

	request(options, function (error, response, body) {
		if (error) throw new Error(error)

		var obj = JSON.parse(body)

		if (obj.active === true) {
			var imgURL = "/img/gameboy.jpg"

			res.json({imgURL: imgURL})
		}
	})
})

// REGISTRATION FORM HANDLER
// TODO: 	* optimize sequencing between creating Okta user and Box user
//			* wait to send Okta activation email until after Box user is set up

app.post('/evaluateRegForm', urlencodedParser, function (req, res) {

	var firstName = req.body.firstName;
	var lastName = req.body.lastName;
	var email = req.body.email;

	console.log("***************first name: " + firstName)

	createOktaUser(firstName, lastName, email, (errMsg, oktaUserID) => {
		if (errMsg) {

			res.json({msg: errMsg})
		}
		else { // SUCCESSFULLY CREATED OKTA USER
			console.log("successfully created an Okta user with id " + oktaUserID);

			res.json({ msg: "success", firstName: firstName, email: email})

			createBoxUser(firstName, lastName, (errMsg, boxUser) => {

				if (errMsg) {
					console.log("something went wrong trying to create a user in Box.");
				}
				else { // SUCCESSFULLY CREATED BOX USER
					console.log("successfully created a Box user with id: " + boxUser.id);

					updateOktaUser(oktaUserID, boxUser.id, (errMsg, result) => {
						if (errMsg) {
							console.log("error updating the Okta user record: " + errMsg);
						}
						else { // UPDATED OKTA USER RECORD WITH BOX ID
							console.log("Okta user record successfully updated with Box ID.");

							var appUserClient = sdk.getAppAuthClient('user', boxUser.id);

							// UPLOAD SAMPLE TXT FILE TO USER'S BOX ACCOUNT

							var stream = fs.createReadStream('sampleFiles/firstFile.txt');

							var fileName = "Welcome to Box Platform, " + firstName + "!.txt";

							appUserClient.files.uploadFile('0', fileName, stream, function(err, res) {
								if (err) throw err;
								else {
									console.log(res);
								}
							});

							// UPLOAD SAMPLE PPT FILE TO USER'S BOX ACCOUNT

							stream = fs.createReadStream('sampleFiles/boxAndOktaPlatformFlows.pptx');

							fileName = "OktaBoxArchitectureFlows.pptx";

							appUserClient.files.uploadFile('0', fileName, stream, function(err, res) {
								if (err) throw err;
								else {
									console.log(res);
								}
							});
						}
					});
				}
			});
		}
	});
});

// ACCEPT ACCESS TOKEN FROM OKTA, GET AN ACCESS TOKEN FROM BOX
app.post('/boxUI', urlencodedParser, function (req, res) {

	// call out to Okta to get the user profile
	console.log("the accessToken is: " + req.body.accessToken)

	var options = {
		method: 'GET',
		url: 'https://' + process.env.OKTA_TENANT + '/oauth2/v1/userinfo',
		headers: {
			'Cache-Control': 'no-cache',
			Authorization: 'Bearer ' + req.body.accessToken,
			Accept: 'application/json'
		}
	}

	request(options, function (error, response, body) {
		if (error) throw new Error(error);

		console.log(body)

		body = JSON.parse(body)

		console.log("the given name is: " + body.given_name);

		console.log("the boxID is: " + body.boxID);

		var appUserClient = sdk.getAppAuthClient('user', body.boxID);

		console.log('App User Client: ' + util.inspect(appUserClient._session));

		appUserClient._session.getAccessToken().then(function(accessToken) {
			console.log("the access token is: " + accessToken);
			res.json({accessToken: accessToken});
		})
	})
})

function createOktaUser(firstName, lastName, email, callback) {

	// CREATE THE USER IN OKTA
	// user will receive an activation email
	var options = {
		"method": "POST",
		"hostname": process.env.OKTA_TENANT,
		"port": null,
		"path": "/api/v1/users?activate=true",
		"headers": {
			"accept": "application/json",
			"content-type": "application/json",
			"authorization": "SSWS " + process.env.OKTA_API_KEY,
			"cache-control": "no-cache"
		}
	}

	var req = http.request(options, function (res) {
		var chunks = [];

		res.on("data", function (chunk) {
			chunks.push(chunk);
		});

		res.on("end", function () {
			var body = Buffer.concat(chunks);
			console.log(body.toString());

			var json = JSON.parse(body);

			if (json.errorCode) {
				var msg;

				// the most common error
				if (json.errorCauses[0].errorSummary == "login: An object with this field already exists in the current organization") {
					msg = "That username already exists in this Okta tenant. Please try another username.";
				}
				else { msg = "Something went wrong with the Okta user registration. Please check the logs."; }

				return callback(msg);
			}
			else {
				return callback(null, json.id);
			}
		});
	});

	req.write(JSON.stringify({ profile: 
		{ firstName: firstName,
			lastName: lastName,
			email: email,
			login: email } }));

	req.end();
}

function createBoxUser(firstName, lastName, callback) {

	var name = firstName + " " + lastName;

	var serviceAccountClient = sdk.getAppAuthClient('enterprise', process.env.BOX_ENTERPRISE_ID);

	serviceAccountClient.enterprise.addAppUser(name, { "is_platform_access_only": true }, function(err, res) {
		if (err) throw err

		else {
			return callback(null, res);
			console.log(res);
		}
	});
}

// UPDATE THE OKTA USER RECORD WITH THE BOX ID

function updateOktaUser(oktaUserID, boxUserID, callback) {

	var options = {
		"method": "POST",
		"hostname": process.env.OKTA_TENANT,
		"port": null,
		"path": "/api/v1/users/" + oktaUserID,
		"headers": {
			"accept": "application/json",
			"content-type": "application/json",
			"authorization": "SSWS " + process.env.OKTA_API_KEY,
			"cache-control": "no-cache"
		}
	}

	var req = http.request(options, function (res) {
		var chunks = [];

		res.on("data", function (chunk) {
			chunks.push(chunk);
		});

		res.on("end", function () {
			var body = Buffer.concat(chunks);
			console.log(body.toString());

			var json = JSON.parse(body);

			if (json.errorCode) {
				return callback(json);
			}
			else {
				return callback(null, "success");
			}
		});
	});

	req.write(JSON.stringify({ profile: { boxID: boxUserID } }));

	req.end();
}

function validateIDtoken(id_token, callback) {

	var path = "/oauth2/v1/introspect?token=" + id_token + "&client_id=" + process.env.OKTA_CLIENT_ID + "&client_secret=" + process.env.OKTA_CLIENT_SECRET

	var options = {
		"method": "POST",
		"hostname": process.env.OKTA_TENANT,
		"port": null,
		"path": path,
		"headers": {
			"content-type": "application/x-www-form-urlencoded",
			"accept": "application/json",
			"cache-control": "no-cache"
		}
	}

	var req = http.request(options, function (res) {
		var chunks = [];

		res.on("data", function (chunk) {
			chunks.push(chunk);
		});

		res.on("end", function () {
			var body = Buffer.concat(chunks);
			console.log(body.toString());

			var json = JSON.parse(body);

			if (json.errorCode) {
				return callback(body.toString());
			}
			else {
				return callback(null, json);
			}
		});
	});

	req.end();
}