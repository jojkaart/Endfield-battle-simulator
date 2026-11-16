// efsim kit-census: kit features per operator.

import { command } from "../command.ts";
import { formatCensus, kitCensus } from "../census.ts";

export default command({
  name: "kit-census",
  usage: `  efsim kit-census                        Kit features per operator, for the review after each new kit
`,
  options: {},
  run: () => formatCensus(kitCensus()),
});
