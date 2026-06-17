import { Request, Response, NextFunction } from 'express';

export const ignoreCompanyHeaderMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  delete req.headers['x-company-id'];
  next();
};
