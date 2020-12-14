import { ActionResultType, SourceLocation } from "./interfaces";

interface ActionResultValue<V> {
    type: ActionResultType.OK;
    value: V;
    location: SourceLocation;
    furthest: SourceLocation;
    expected: string[];
}

interface ActionResultFailure {
    type: ActionResultType.Fail;
    location: SourceLocation;
    furthest: SourceLocation;
    expected: string[];
}

type ActionData<V> = ActionResultValue<V>|ActionResultFailure;

export class ActionResult<A> {
    
    public type: ActionResultType;
    public value?: A;
    public location: SourceLocation;
    public furthest: SourceLocation;
    public expected: string[];

    constructor(data: ActionResultValue<A>|ActionResultFailure) {
        this.type = data.type
        if (data.type === ActionResultType.OK) {
            this.value = data.value
        } else {
            this.value = undefined
        }
        this.location = data.location
        this.furthest = data.furthest
        this.expected = data.expected
    }

    transform<B>(fn: (value: A) => B): ActionResult<B> {
        if (this.type === ActionResultType.OK) {
            return new ActionResult<B>({ ...this, type: ActionResultType.OK, value: fn(this.value!) })
        } else {
            return this as unknown as ActionResult<B>
        }
    }

    update<B>(data: ActionResult<B>) {
        const a = this as ActionData<A>
        const b = data as ActionData<B>
        return new ActionResult<B>(merge<A, B>(a, b));
    }
}


function merge<A, B>(a: ActionData<A>, b: ActionData<B>): ActionData<B> {
    if (a.furthest.index > b.furthest.index) return {
        ...b, expected: a.expected, furthest: a.furthest
    };

    if (a.furthest.index < b.furthest.index) return {
        ...b, expected: b.expected, furthest: b.furthest
    };

    const expected = [...new Set([...a.expected, ...b.expected])]
    return {
        ...b, expected: expected, furthest: a.furthest
    };
}