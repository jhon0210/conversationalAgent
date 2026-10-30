export class AppError extends Error {
  constructor(
    message: string,
    readonly codigo: string = "ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}
