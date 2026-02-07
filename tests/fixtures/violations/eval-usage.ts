export function dangerousEval(code: string) {
  return eval(code);
}

export function dangerousFunction(code: string) {
  return new Function(code)();
}
