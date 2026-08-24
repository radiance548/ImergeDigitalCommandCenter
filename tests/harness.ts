interface RegisteredTest {
  suite: string;
  name: string;
  fn: () => void | Promise<void>;
}

const tests: RegisteredTest[] = [];
let currentSuite = "";

export function describe(suite: string, fn: () => void) {
  currentSuite = suite;
  fn();
  currentSuite = "";
}

export function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ suite: currentSuite, name, fn });
}

export async function runAll() {
  let pass = 0;
  let fail = 0;
  let lastSuite = "";

  for (const t of tests) {
    if (t.suite !== lastSuite) {
      console.log(`\n${t.suite}`);
      lastSuite = t.suite;
    }
    try {
      await t.fn();
      pass++;
      console.log(`  \x1b[32m✓\x1b[0m ${t.name}`);
    } catch (error) {
      fail++;
      console.log(`  \x1b[31m✗\x1b[0m ${t.name}`);
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.log(
        message
          .split("\n")
          .map((l) => `      ${l}`)
          .join("\n")
      );
    }
  }

  console.log(`\n${"-".repeat(40)}`);
  console.log(`${pass} passed, ${fail} failed, ${tests.length} total`);
  if (fail > 0) process.exitCode = 1;
}
