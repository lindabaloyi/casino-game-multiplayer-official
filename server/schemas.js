const Joi = require('joi');

const cardSchema = Joi.object({
  rank: Joi.string().required(),
  suit: Joi.string().required(),
  value: Joi.number().required(),
});

const trailSchema = Joi.object({
  card: cardSchema.required(),
});

const captureSchema = Joi.object({
  draggedItem: Joi.object().required(),
  targetCard: cardSchema.required(),
});

const buildSchema = Joi.object({
  draggedItem: Joi.object().required(),
  targetCard: cardSchema.required(),
  buildValue: Joi.number().required(),
  biggerCard: cardSchema.optional(),
  smallerCard: cardSchema.optional(),
});

const addToOwnBuildSchema = Joi.object({
  draggedItem: Joi.object().required(),
  buildToAddTo: Joi.object().required(),
});

const createBuildFromStackSchema = Joi.object({
  draggedItem: Joi.object().required(),
  stackToBuildFrom: Joi.object().required(),
});

module.exports = {
  trailSchema,
  captureSchema,
  buildSchema,
  addToOwnBuildSchema,
  createBuildFromStackSchema,
};