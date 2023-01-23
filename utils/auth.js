const jwt = require('jsonwebtoken');

const secret = 'mysecretssshhhhhhh';  // process.env.SECRET
const expiration = '2h'; 

module.exports = {
  authMiddleware: ({ req }) => {
    // allows token to be sent via one of the 3 following (usually req.headers)
    let token = req.body.token || req.query.token || req.headers.authorization;

    if (req.headers.authorization) {
      token = token.split(' ').pop().trim();
    }

    if (!token) return req;
    // if token can be verified, add the decoded user's data to the requestt so it can be accessed in the resolver
    try {
      const { data } = jwt.verify(token, secret, { maxAge: expiration });
      req.user = data;
    } catch {
      console.log('Invalid token');
    }

    // return the request object so it can be passed to the resolver as 'context'
    return req;
  },
  signToken: ({ email, username, _id }) => {
    const payload = { email, username, _id };
    return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
  }
};