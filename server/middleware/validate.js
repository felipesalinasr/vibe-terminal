/**
 * Express middleware that validates req.body against a Zod schema.
 * Invalid requests get a 400 with structured Zod error details.
 *
 * Adapted from paperclip-master/server/src/middleware/validate.ts
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation error',
        details: result.error.errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
