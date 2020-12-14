/**
 * Represents a location in the input (source code). Keeps track of `index` (for
 * use with `.slice` and such), as well as `line` and `column` for displaying to
 * users.
 */
export interface SourceLocation {
    /** The string index into the input (e.g. for use with `.slice`) */
    index: number;
    /**
     * The line number for error reporting. Only the character `\n` is used to
     * signify the beginning of a new line.
     */
    line: number;
    /**
     * The column number for error reporting.
     */
    column: number;
}

export const enum ActionResultType {
    Fail,
    OK,
}


// Eventually drop strings to get ints
export const enum ResultTypeEnum {
    Fail = "ParseFail",
    OK = "ParseOK",
    Node = "ParseNode",
}


/**
 * Represents the result of a parser's action callback.
 */
export type ActionResult<A> = ActionOK<A> | ActionFail;

/**
 * Represents a successful result from a parser's action callback. This is made
 * automatically by calling `context.ok`. Make sure to use `context.merge`
 * when writing a custom parser that executes multiple parser actions.
 */
export interface ActionOK<A> {
  type: ActionResultType.OK;
  location: SourceLocation;
  value: A;
  furthest: SourceLocation;
  expected: string[];
}

/**
 * Represents a successful result from a parser's action callback. This is made
 * automatically by calling `context.ok`. Make sure to use `context.merge`
 * when writing a custom parser that executes multiple parser actions.
 */
export interface ActionFail {
  type: ActionResultType.Fail;
  location: SourceLocation;
  furthest: SourceLocation;
  expected: string[];
}


/**
 * Represents a successful parse result.
 */
export interface ParseOK<A> {
    type: ResultTypeEnum.OK;
    /** The parsed value */
    value: A;
}

/**
 * Represents a failed parse result, where it failed, and what types of
 * values were expected at the point of failure.
 */
export interface ParseFail {
    type: ResultTypeEnum.Fail;
    /** The input location where the parse failed */
    location: SourceLocation;
    /** List of expected values at the location the parse failed */
    expected: string[];
}

/**
 * Result type from `node`. See `node` for more details.
 */
export interface ParseNode<S extends string, A> {
    type: ResultTypeEnum.Node;
    name: S;
    value: A;
    start: SourceLocation;
    end: SourceLocation;
}
