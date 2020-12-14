import { ActionResult } from "./ActionResult";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";


export function Describe<A>(parser: Parser<A>, expected: string[]) {
  return new Parser<A>((context) => {
    const result = parser.action(context);
    if (result.type === ActionResultType.OK) {
      return result;
    }
    return new ActionResult({
      type: ActionResultType.Fail,
      furthest: result.furthest,
      location: context.location,
      expected: expected
    });
  });
}
