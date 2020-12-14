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
    return this.chain((a) => {
      return ok(fn(a));
    });
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
        furthest: result.furthest,
        expected
      };
    });
  }

  /**
   * Wraps the current parser with before & after parsers.
   */
  wrap<B, C>(before: Parser<B>, after: Parser<C>): Parser<A> {
    return before.next(this).skip(after);
  }

  /**
   * Ignores content before and after the current parser, based on the supplied
   * parser.
   */
  trim<B>(beforeAndAfter: Parser<B>): Parser<A> {
    return this.wrap(beforeAndAfter, beforeAndAfter);
  }

  /**
   * Repeats the current parser between min and max times, yielding the results
   * in an array.
   */
  repeat(min = 0, max = Infinity): Parser<A[]> {
    if (!isRangeValid(min, max)) {
      throw new Error(`repeat: bad range (${min} to ${max})`);
    }
    if (min === 0) {
      return this.repeat(1, max).or(ok([]));
    }
    return new Parser((context) => {
      const items: A[] = [];
      let result = this.action(context);
      if (result.type === ActionResultType.Fail) {
        return result;
      }
      while (result.type === ActionResultType.OK && items.length < max) {
        items.push(result.value);
        if (result.location.index === context.location.index) {
          throw new Error(
            "infinite loop detected; don't call .repeat() with parsers that can accept zero characters"
          );
        }
        context = context.moveTo(result.location);
        result = merge(result, this.action(context));
      }
      if (result.type === ActionResultType.Fail && items.length < min) {
        return result;
      }
      return merge(result, context.ok(items));
    });
  }

  /**
   * Returns a parser that parses between min and max times, separated by the separator
   * parser supplied.
   */
  sepBy<B>(separator: Parser<B>, min = 0, max = Infinity): Parser<A[]> {
    if (!isRangeValid(min, max)) {
      throw new Error(`sepBy: bad range (${min} to ${max})`);
    }
    if (min === 0) {
      return this.sepBy(separator, 1, max).or(ok([]));
    }
    // We also know that min=1 due to previous checks, so we can skip the call
    // to `repeat` here
    if (max === 1) {
      return this.map((x) => [x]);
    }
    return this.chain((first) => {
      return separator
        .next(this)
        .repeat(min - 1, max - 1)
        .map((rest) => {
          return [first, ...rest];
        });
    });
  }

  /**
   * Returns a parser that adds name and start/end location metadata.
   */
  node<S extends string>(name: S): Parser<ParseNode<S, A>> {
    return all(location, this, location).map(([start, value, end]) => ({
      type: ResultTypeEnum.Node, name, value, start, end 
    }))
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
  return context.ok(context.location);
});

/**
 * Returns a parser that yields the given value and consumes no input.
 */
export function ok<A>(value: A): Parser<A> {
  return new Parser(context => context.ok(value));
}

/**
 * Returns a parser that fails with the given messages and consumes no input.
 */
export function fail<A>(expected: string[]): Parser<A> {
  return new Parser(context => context.fail(expected));
}

/**
 * This parser succeeds if the input has already been fully parsed.
 */
export const eof = new Parser<"<EOF>">((context) => {
  if (context.location.index < context.input.length) {
    return context.fail(["<EOF>"]);
  } else {
    return context.ok("<EOF>");
  }
});

/** Returns a parser that matches the exact text supplied. */
export function text<A extends string>(string: A): Parser<A> {
  return new Parser<A>((context) => {
    const start = context.location.index;
    const end = start + string.length;

    if (context.input.slice(start, end) === string) {
      return context.at(end).ok(string);
    } else {
      return context.fail([string]);
    }

  });
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
      context = context.at(end)
      return context.ok(string);
    }
    return context.fail([String(regexp)]);
  });
}

/** A tuple of parsers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ManyParsers<A extends any[]> = {
  [P in keyof A]: Parser<A[P]>;
};

/** Parse all items, returning their values in the same order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function all<A extends any[]>(...parsers: ManyParsers<A>): Parser<A> {
  return new Parser((context) => {
    var reports: ActionOK<A>[] = []
  
    for (let parser of parsers) {
        const report = parser.action(context);
        if (report.type === ActionResultType.Fail) 
          return mergeAll(...reports, report)
        reports.push(report);
        context = context.moveTo(report.location);
    }

    const values = reports.map(result => result.value)
    const report = context.ok(values)
    return mergeAll(...reports, report);
  });
}

/** Parse using the parsers given, returning the first one that succeeds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function choice<Parsers extends Parser<any>[]>(...parsers: Parsers): Parser<ReturnType<Parsers[number]["tryParse"]>> {
  return new Parser((context) => {
    var reports: ActionFail[] = []
  
    for (let parser of parsers) {
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


/**
 * Represents the current parsing context.
 */
class Context {

  constructor(
    public input: string,
    public location: SourceLocation
  ) { }

  /**
   * Returns a new context with the supplied location and the current input.
   */
  moveTo(location: SourceLocation): Context {
    return new Context(this.input, location);
  }

  private _internal_move(newIndex: number): SourceLocation {
    var { index, line, column } = this.location;

    while (index < newIndex) {
      const ch = this.input[index++]
      column++;
      if (ch === "\n") {
        line++;
        column = 1;
      }
    }
    
    return { index, line, column };
  }

  at(index: number) {
    const location = this._internal_move(index)
    return this.moveTo(location)
  }

  /**
   * Represents a successful parse ending before the given `index`, with the
   * specified `value`.
   */
  ok<A>(value: A): ActionResult<A> {
    return {
      type: ActionResultType.OK,
      value,
      location: this.location,
      furthest: { index: -1, line: -1, column: -1 },
      expected: [],
    };
  }

  /**
   * Represents a failed parse starting at the given `index`, with the specified
   * list `expected` messages (note: this list usually only has one item).
   */
  fail<A>(expected: string[]): ActionResult<A> {
    return {
      type: ActionResultType.Fail,
      furthest: this.location,
      expected,
    };
  }


}

function mergeAll(...rest: ActionResult<any>[]): ActionResult<any> {
  return rest.reduce(merge)
}


/**
* Merge two sequential `ActionResult`s so that the `expected` and location data
* is preserved correctly.
*/
function merge<A, B>(a: ActionResult<A>, b: ActionResult<B>): ActionResult<B> {
  if (a.furthest.index > b.furthest.index) return {
    ...b,
    expected: a.expected,
    furthest: a.furthest
  }

  if (a.furthest.index < b.furthest.index) return {
    ...b,
    expected: b.expected,
    furthest: b.furthest
  }

  return {
    ...b,
    expected: [...new Set([...a.expected, ...b.expected])],
    furthest: a.furthest
  }
}