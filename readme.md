# Okta + Box Platform

This node.js app allows you to add Okta as the identity provider for your Box Platform installation.

Using Okta, you can add new users to your Box Platform instance, and those users can then authenticate against Okta and use the [Box Content Explorer](https://developer.box.com/docs/box-content-explorer) to manage their files.

## Pre-requisites
### Okta
* Okta tenant
* API key
* OIDC app

### Box
* Developer account
* Box content explorer setup

## Setup
Dependencies are in package.json
```
npm install
```

For configuration, copy the the .env_example file to a file called

.env

and fill in the appropriate values.

When you set up your Box application, you will get a private key. Store this key in

/boxKey.pem

Now you can run the app:
```
node app.js
```