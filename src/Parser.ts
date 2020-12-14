import { ActionResult } from "./ActionResult";
import { Context } from "./Context";
import { ParseOK, ParseFail } from "./interfaces";
import { ResultTypeEnum, ActionResultType } from "./interfaces";
import { eof, toParser, isRangeValid, location } from "./bread-n-butter";
import { choice } from "./choice";
import { all } from "./all";
import { Separated } from "./Separated";
import { Repeat } from "./Repeat";

export class Parser<A> {

  constructor(public action: (context: Context) => ActionResult<A>) { }

  parse(input: string): ParseOK<A> | ParseFail {
    const location = { index: 0, line: 1, column: 1 };
    const context = new Context(input, location);
    const result = this.skip(eof).action(context);
    if (result.type === ActionResultType.OK) {
      return {
        type: ResultTypeEnum.OK,
        value: result.value!,
      };
    }
    return {
      type: ResultTypeEnum.Fail,
      location: result.furthest,
      expected: result.expected,
    };
  }

  tryParse(input: string): A {
    const result = this.parse(input);
    if (result.type === ResultTypeEnum.OK) {
      return result.value;
    }
    throw new Error(`parse error at line ${result.location.line} ` +
      `column ${result.location.column}: ` +
      `expected ${result.expected.join(", ")}`);
  }

  and<B>(parserB: Parser<B>): Parser<[A, B]> {
    return all<[A, B]>(this, parserB);
  }

  skip<B>(parserB: Parser<B>): Parser<A> {
    return all<[A, B]>(this, parserB).map(([a]) => a);
  }

  next<B>(parserB: Parser<B>): Parser<B> {
    return all<[A, B]>(this, parserB).map(([, b]) => b);
  }

  or<B>(parserB: Parser<B>): Parser<A | B> {
    return choice(this, parserB);
  }

  chain<B>(fn: (value: A) => Parser<B>): Parser<B> {
    return new Parser((context) => {
      const a = this.action(context);
      if (a.type !== ActionResultType.OK) {
        return a as unknown as ActionResult<B>;
      }
      context = context.moveTo(a.location);
      const parserB = fn(a.value!);
      const b = parserB.action(context);
      return a.update(b);
    });
  }

  map<B>(fn: (value: A) => B): Parser<B> {
    const parent = this;
    return new Parser(function (context) {
      return parent.action(context).transform<B>(fn);
    });
  }

  thru<B>(fn: (parser: this) => B): B {
    return fn(this);
  }

  desc(expected: string[]): Parser<A> {
    return new Parser((context) => {
      const result = this.action(context);
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

  wrap<B = string, C = string>(before: Parser<B> | string, after: Parser<C> | string): Parser<A> {
    return toParser(before).next(this).skip(toParser(after));
  }

  trim<B = string>(beforeAndAfter: Parser<B> | string): Parser<A> {
    return this.wrap(toParser(beforeAndAfter), toParser(beforeAndAfter));
  }

  repeat(min = 0, max = Infinity): Parser<A[]> {
    if (!isRangeValid(min, max))
      throw new Error(`repeat: bad range (${min} to ${max})`);
    return Repeat(this, min, max);
  }

  sepBy<B = string>(separator: Parser<B> | string, min = 0, max = Infinity): Parser<A[]> {
    if (!isRangeValid(min, max))
      throw new Error(`sepBy: bad range (${min} to ${max})`);
    return Separated(this, toParser(separator), min, max);
  }

  node<S extends string>(name: S) {
    return all(location, this, location).map(function ([start, value, end]) {
      const type = ResultTypeEnum.Node;
      return { type, name, value, start, end };
    });
  }
}
