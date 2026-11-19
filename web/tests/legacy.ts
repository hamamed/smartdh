// Loads named top-level functions straight out of the Express app's server.js, so
// tests can run the original and the port side by side on the same input.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ACHIEVEMENTS } from "../src/lib/constants";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "../../server.js"), "utf8");

function extract(name: string): string {
  const start = SOURCE.search(new RegExp(`^function ${name}\\(`, "m"));
  if (start < 0) throw new Error(`function ${name} not found in server.js`);
  const end = SOURCE.indexOf("\n}\n", start);
  return SOURCE.slice(start, end + 2);
}

/** Returns the original functions, evaluated together with the given helpers in scope. */
export function legacy<T extends Record<string, (...args: never[]) => unknown>>(names: string[], extra: Record<string, unknown> = {}): T {
  const context = vm.createContext({ DAY: 86400000, ACHIEVEMENTS, Math, Date, Object, Number, Set, String, ...extra });
  vm.runInContext(names.map(extract).join("\n") + `\nthis.__out = { ${names.join(", ")} };`, context);
  return (context as unknown as { __out: T }).__out;
}
