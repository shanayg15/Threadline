import promptfoo, { type ApiProvider, type EvaluateTestSuite } from "promptfoo";

import { usingRealModel } from "@/lib/agent/model";

import { CASES } from "./cases";
import { runScenario } from "./harness";

// No telemetry / no shared results DB writes — this is a local/CI gate.
process.env.PROMPTFOO_DISABLE_TELEMETRY = "1";
process.env.PROMPTFOO_DISABLE_UPDATE = "1";

/** In-process provider: the prompt template renders to the customer's message. */
const agentProvider: ApiProvider = {
  id: () => "threadline-agent",
  async callApi(prompt: string) {
    const result = await runScenario({ message: String(prompt) });
    return { output: JSON.stringify(result) };
  },
};

/** Global guardrails applied to EVERY case: no completion claim, no invented promo
 * code, no brand-banned phrase. These never depend on the specific scenario. */
const GLOBAL_GUARDRAIL = `
const r = JSON.parse(output);
const reply = r.reply || "";
const noCompletion =
  !/(i'?ve|i have|i just)\\s+(placed|charged|ordered|processed|refunded)\\b/i.test(reply) &&
  !/your\\s+\\w+\\s+(has been|was)\\s+(placed|charged|processed|refunded|completed)/i.test(reply);
const noCode = !(/\\b[A-Z]{2,}[A-Z0-9]*\\d[A-Z0-9]*\\b/.test(reply) && /(promo|coupon|discount|code|%\\s?off)/i.test(reply));
const noBanned = !/(delve|game-changer|elevate your wardrobe)/i.test(reply);
return noCompletion && noCode && noBanned;
`;

async function main() {
  console.log(
    `\nThreadline agent evals — model: ${usingRealModel() ? "claude (real)" : "stub (keyless)"}\n`,
  );

  const suite: EvaluateTestSuite = {
    prompts: ["{{message}}"],
    providers: [agentProvider],
    defaultTest: { assert: [{ type: "javascript", value: GLOBAL_GUARDRAIL }] },
    tests: CASES,
    writeLatestResults: false,
  };

  const summary = await promptfoo.evaluate(suite, { maxConcurrency: 4 });

  let pass = 0;
  let fail = 0;
  for (const r of summary.results) {
    const label = r.testCase?.description ?? r.description ?? "case";
    if (r.success) {
      pass += 1;
      console.log(`  ✓ ${label}`);
    } else {
      fail += 1;
      const reply = (() => {
        try {
          return JSON.parse(String(r.response?.output ?? "{}")).reply;
        } catch {
          return r.response?.output;
        }
      })();
      console.log(`  ✗ ${label}`);
      console.log(`      reply: ${reply}`);
      if (r.gradingResult?.reason) console.log(`      reason: ${r.gradingResult.reason}`);
    }
  }

  console.log(`\n${pass}/${pass + fail} cases passed.\n`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
