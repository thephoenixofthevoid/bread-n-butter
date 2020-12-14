import { Context, failure, merge, success } from "./Context";
import type { ParseOK, ParseFail, ParseNode, SourceLocation, ActionResult, ActionOK, ActionFail } from "./interfaces";
import { ResultTypeEnum, ActionResultType } from "./interfaces";
export { ParseOK, ParseFail, ParseNode, SourceLocation, ActionResult }

/**
 * The parsing action. Takes a parsing Context and returns an ActionResult
 * representing success or failure.
 */
export type ParsingAction<A> = (context: Context) => ActionResult<A>

/**
 * Represents a parsing action; typically not created directly via `new`.
 */
export class Parser<A> {
  /**
   * Creates a new custom parser that performs the given parsing action.
   */
  constructor(public action: ParsingAction<A>) { }

  /**
   * Returns a parse result with either the value or error information.
   */
  parse(input: string): ParseOK<A> | ParseFail {
    const location = { index: 0, line: 1, column: 1 };
    const context = new Context(input, location);
    const result = this.skip(eof).action(context);
    if (result.type === ActionResultType.OK) {
      return {
        type: ResultTypeEnum.OK,
        value: result.value,
      };
    }
    return {
      type: ResultTypeEnum.Fail,
      location: result.furthest,
      expected: result.expected,
    };
  }

  /**
   * Returns the parsed result or throws an error.
   */
  tryParse(input: string): A {
    const result = this.parse(input);
    if (result.type === ResultTypeEnum.OK) {
      return result.value;
    }

    throw new Error(`parse error at line ${result.location.line} ` +
      `column ${result.location.column}: ` +
      `expected ${result.expected.join(", ")}`);
  }

  /**
   * Combines two parsers one after the other, yielding the results of both in
   * an array.
   */
  and<B>(parserB: Parser<B>): Parser<[A, B]> {
    return all<[A, B]>(this, parserB)
  }

  /** Parse both and return the value of the first */
  skip<B>(parserB: Parser<B>): Parser<A> {
    return all<[A, B]>(this, parserB).map(([a]) => a);
  }

  /** Parse both and return the value of the second */
  next<B>(parserB: Parser<B>): Parser<B> {
    return all<[A, B]>(this, parserB).map(([, b]) => b);
  }

  /**
   * Try to parse using the current parser. If that fails, parse using the
   * second parser.
   */
  or<B>(parserB: Parser<B>): Parser<A | B> {
    return choice(this, parserB)
  }

  /**
   * Parse using the current parser. If it succeeds, pass the value to the
   * callback function, which returns the next parser to use.
   */
  chain<B>(fn: (value: A) => Parser<B>): Parser<B> {
    return new Parser((context) => {
      const a = this.action(context);
      if (a.type === ActionResultType.Fail) {
        return a;
      }
      context = context.moveTo(a.location);

      const parserB = fn(a.value);
      const b = parserB.action(context)
      return merge(a, b);
    });
  }

  /**
   * Yields the value from the parser after being called with the callback.
   */
  map<B>(fn: (value: A) => B): Parser<B> {
    const parent = this;
    return new Parser(function (context) {
      const report = parent.action(context)
      if (report.type === ActionResultType.OK) {
        return {
          ...report,
          value: fn(report.value)
        }
      } else {
        return report
      }
    })
  }

  /**
   * Returns the callback called with the parser.
   */
  thru<B>(fn: (parser: this) => B): B {
    return fn(this);
  }

  /**
   * Returns a parser which parses the same value, but discards other error
   * messages, using the ones supplied instead.
   */
  desc(expected: string[]): Parser<A> {
    return new Parser((context) => {
      const result = this.action(context);
      if (result.type === ActionResultType.OK) {
        return result;
      }
      return {
        type: ActionResultType.Fail,
        value: undefined,
        furthest: result.furthest,
        location: context.location,
        expected: expected
      };
    });
  }

  /**
   * Wraps the current parser with before & after parsers.
   */
  wrap<B = string, C = string>(before: Parser<B> | string, after: Parser<C> | string): Parser<A> {
    return toParser(before).next(this).skip(toParser(after));
  }

  /**
   * Ignores content before and after the current parser, based on the supplied
   * parser.
   */
  trim<B = string>(beforeAndAfter: Parser<B> | string): Parser<A> {
    return this.wrap(toParser(beforeAndAfter), toParser(beforeAndAfter));
  }

  /**
   * Repeats the current parser between min and max times, yielding the results
   * in an array.
   */
  repeat(min = 0, max = Infinity): Parser<A[]> {
    if (!isRangeValid(min, max)) throw new Error(`repeat: bad range (${min} to ${max})`);
    return Repeat(this, min, max);
  }

  /**
   * Returns a parser that parses between min and max times, separated by the separator
   * parser supplied.
   */
  sepBy<B = string>(separator: Parser<B> | string, min = 0, max = Infinity): Parser<A[]> {
    if (!isRangeValid(min, max)) throw new Error(`sepBy: bad range (${min} to ${max})`);
    return Separated(this, toParser(separator), min, max)
  }

  /**
   * Returns a parser that adds name and start/end location metadatb
   */
  node<S extends string>(name: S) {
    return all(location, this, location)
          .map(function ([start, value, end]) {
            const type = ResultTypeEnum.Node
            return { type, name, value, start, end }
          })
  }
}


export function Separated<A, B>(itemParser: Parser<A>, sepParser: Parser<B>, min: number, max: number): Parser<A[]> {
  itemParser = toParser(itemParser)
  sepParser = toParser(sepParser)
  const pairParser = sepParser.next(itemParser)

  return new Parser(function (context) {
    var report: ActionResult<A> = failure(context, []) as ActionFail;
    var values: A[] = [];

    while (values.length < max) {
      if (values.length > 0) {
        report = merge(report, pairParser.action(context))
      } else {
        report = merge(report, itemParser.action(context))
      }
      if (report.type !== ActionResultType.OK) break;
      context = context.moveTo(report.location)
      values.push(report.value)
    }
    if (values.length < min) {
      return merge(report, failure(context, []))
    } else {
      return merge(report, success(context, values))
    }
  })
}



export function Repeat<A>(itemParser: Parser<A>, min: number, max: number): Parser<A[]> {
  return new Parser(function (context) {

    var report: ActionResult<A> = failure(context, []) as ActionFail;
    var values: A[] = [];

    while (values.length < max) {
      report = merge(report, itemParser.action(context))
      if (report.type !== ActionResultType.OK) break;
      validateInfiniteLoop(context, report);
      context = context.moveTo(report.location)
      values.push(report.value)
    }

    if (values.length < min) {
      return merge(report, failure(context, []))
    } else {
      return merge(report, success(context, values))
    }
  })
}

function validateInfiniteLoop<A>(context: Context, result: ActionResult<A>) {
  if (result.location.index === context.location.index) {
    throw new Error(
      "infinite loop detected; don't call .repeat() with parsers that can accept zero characters"
    );
  }
}

function isRangeValid(min: number, max: number): boolean {
  return (
    min <= max &&
    min >= 0 &&
    max >= 0 &&
    Number.isInteger(min) &&
    min !== Infinity &&
    (Number.isInteger(max) || max === Infinity)
  );
}

/**
 * Parser that yields the current `SourceLocation`, containing properties
 * `index`, `line` and `column`.
 */
export const location = new Parser<SourceLocation>((context) => {
  return success(context, context.location);
});

/**
 * Returns a parser that yields the given value and consumes no input.
 */
export function ok<A>(value: A): Parser<A> {
  return new Parser(context => success(context, value));
}

/**
 * Returns a parser that fails with the given messages and consumes no input.
 */
export function fail<A>(expected: string[]): Parser<A> {
  return new Parser(context => failure(context, expected));
}

/**
 * This parser succeeds if the input has already been fully parsed.
 */
export const eof = new Parser<"<EOF>">((context) => {
  if (context.location.index < context.input.length) {
    return failure(context, ["<EOF>"]);
  } else {
    return success(context, "<EOF>");
  }
});

/** Returns a parser that matches the exact text supplied. */
export function text<A extends string>(string: A): Parser<A> {
  return new Parser<A>((context) => {
    const start = context.location.index;
    const end = start + string.length;

    if (context.input.slice(start, end) === string) {
      return success(context.moveTo(end), string);
    } else {
      return failure(context, [string]);
    }

  });
}


export function lookahead<B>(parser: Parser<B>) {
  return new Parser(function (context) {
    const a = parser.action(context)
    if (a.type !== ActionResultType.OK) {
      return a
    }
    return merge(a, success(context, a.value))
  })
}

export function notFollowing<B>(parser: Parser<B>) {
  return new Parser(function (context) {
    const a = parser.action(context)
    if (a.type === ActionResultType.OK) {
      const b = failure<null>(context, [`not '${a.value}'`])
      return merge(a, b)
    }
    return merge(a, success(context, null))
  })
}

/**
 * Returns a parser that matches the entire regular expression at the current
 * parser position.
 */
export function match(regexp: RegExp): Parser<string> {
  for (const flag of regexp.flags) {
    switch (flag) {
      case "i": // ignoreCase
      case "s": // dotAll
      case "m": // multiline
      case "u": // unicode
        continue;
      default:
        throw new Error("only the regexp flags 'imsu' are supported");
    }
  }
  const sticky = new RegExp(regexp.source, regexp.flags + "y");
  return new Parser((context) => {
    const start = context.location.index;
    sticky.lastIndex = start;
    const match = context.input.match(sticky);
    if (match) {
      const end = start + match[0].length;
      const string = context.input.slice(start, end);
      context = context.moveTo(end)
      return success(context, string);
    }
    return failure(context, [String(regexp)]);
  });
}

/** A tuple of parsers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ManyParsers<A extends any[]> = {
  [P in keyof A]: Parser<A[P]> | A[P];
};


function toParser(parser: string | RegExp | Parser<any>) {
  if (typeof parser === "string") {
    return text(parser)
  }
  if (parser instanceof RegExp) {
    return match(parser)
  }
  return parser
}


/** Parse all items, returning their values in the same order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function all<A extends any[]>(...parsers: ManyParsers<A>): Parser<A> {
  parsers = parsers.map(toParser) as ManyParsers<A>;
  return new Parser((context) => {
    const reports: ActionOK<A>[] = []
    const values = new Array(parsers.length) as A;

    for (let i = 0; i < parsers.length; i++) {
      const parser: ManyParsers<A>[typeof i] = parsers[i];
      const report = parser.action(context);

      context = context.moveTo(report.location);
      if (report.type === ActionResultType.Fail)
        return mergeAll(...reports, report)
      reports.push(report);
      values[i] = report.value
    }

    const report = success(context, values)
    return mergeAll(...reports, report);
  });
}

/** Parse using the parsers given, returning the first one that succeeds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function choice<Parsers extends (Parser<any> | any)[]>(...parsers: Parsers): Parser<ReturnType<Parsers[number]["tryParse"]>> {
  parsers = parsers.map(toParser) as Parsers;

  return new Parser((context) => {
    var reports: ActionFail[] = []
    for (let i = 0; i < parsers.length; i++) {
      const parser = parsers[i];
      const report = parser.action(context);
      if (report.type === ActionResultType.OK)
        return mergeAll(...reports, report)
      reports.push(report);
    }

    return mergeAll(...reports);
  });
}

/**
 * Takes a lazily invoked callback that returns a parser, so you can create
 * recursive parsers.
 */
export function lazy<A>(fn: () => Parser<A>): Parser<A> {
  return new Parser(function (this: Parser<A>, context) {
    this.action = fn().action;
    return this.action(context);
  });
}

function mergeAll(...rest: ActionResult<any>[]): ActionResult<any> {
  return rest.reduce(merge)
}
