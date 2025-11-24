import { Response } from "express";

interface ErrorResponse extends Response {
 json(data: {
  message?: string;
  error?: string;
 }): Response<any, Record<string, any>>;
}