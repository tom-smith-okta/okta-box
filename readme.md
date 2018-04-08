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

*NOTE: if you are not interested in the MFA-only piece (see below) you can ignore the OKTA_MFA_ settings.*

When you set up your Box application, you will get a private key. Store this key in

/boxKey.pem

Now you can run the app:
```
node app.js
```

___

MFA-only via OIDC - Beta/undocumented/experimental/unsupported

This repo also illustrates Okta's "MFA only via OIDC" capability - in beta as of April 2018.

You can explore this capability by clicking on the "Get MFA-protected Asset" link. The answer to the security question is

okta

The "MFA-only flow" shows how this flow works. It is completely independent of any other Okta session: the user will be challenged for MFA regardless of whether they already have an Okta session.