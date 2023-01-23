require('dotenv');
const { AuthenticationError } = require('apollo-server-express');
const { User, Bouquet, Occasion, Order } = require('../models');
const { signToken } = require('../utils/auth');
const stripe = require('stripe')(process.env.API);

const resolvers = {
  Query: {
    users: async () => {
      const users = await User.find().populate('orders');
      return users;
    },
    me: async (_, args, context) => {
      if (context.user) {
        return User.findOne({ _id: context.user._id }).populate('orders');
      }
      throw new AuthenticationError('You need to be logged in!');
    },
    occasions: async () => {
      return Occasion.find();
    },
    allBouquets: async (_, { occasionId }) => {
      return Bouquet.find({ occasion: occasionId }).populate('occasion');
    },
    bouquet: async (_, { bouquetId }) => {
      return Bouquet.findOne({ _id: bouquetId }).populate('occasion');;
    },
    featured: async () => {
      return Bouquet.find({ featured: true }).populate('occasion');
    },
    checkout: async (parent, args, context) => {
      const url = new URL(context.headers.referer).origin;
      const order = new Order({ products: args.products });
      const line_items = [];
      
      const { products } = await order.populate('products');
      
      for (let i = 0; i < products.length; i++) {
        const product = await stripe.products.create({
          name: products[i].name,
          description: products[i].description,
        });

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: products[i].price * 100,
          currency: 'usd',
        });

        line_items.push({
          price: price.id,
          quantity: 1
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: `${url}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${url}/`
      });

      return { session: session.id };
    }
  },
  // Mutation to add users
  Mutation: {
    addUser: async (_, args) => {
      // create a user through mongoose passing args: email, username, password
      const user = await User.create(args);
      // signing a token using jwt.sign
      const token = signToken(user);
      // returning an Auth result
      return { token, user };
    },
    // Mutation to login as a user
    login: async (_, { email, password }) => {
      // Finds one user who's email matches the posted email
      const user = await User.findOne({ email });
// checks to see if user exists
      if (!user) {
        // if not throw auth error
        throw new AuthenticationError('No user found with this email address');
      }
//  if user exissts check for corrrect password
      const correctPw = await user.isCorrectPassword(password);
// if password is incoreect throw auth error
      if (!correctPw) {
        throw new AuthenticationError('Incorrect credentials');
      }
// signing a token using jwt.sign
      const token = signToken(user);
// returning an Auth result 
      return { token, user };
    },
    addOrder: async (parent, { products }, context) => {
      if (context.user) {
        const order = new Order({ products });
  
        await User.findByIdAndUpdate(context.user._id, { $push: { orders: order } });
  
        return order;
      }
  
      throw new AuthenticationError('Not logged in');
    },
  },
};

module.exports = resolvers;
