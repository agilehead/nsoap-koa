import nsoap from "../nsoap-koa";
import should from "should";
import koa from "koa";
import request from "supertest";
import bodyParser from "koa-bodyparser";

const routes = {
  index() {
    return "Home page!";
  },
  about() {
    return "NSOAP Test Suite";
  },
  static: "NSOAP Static File",
  unary(arg) {
    return arg + 10;
  },
  binary(x, y) {
    return x + y;
  },
  divide(x, y) {
    return x / y;
  },
  tripletAdder(x,y,z) {
    return x + y + z;
  },
  namespace: {
    binary(x, y) {
      return x + y;
    }
  },
  nested: {
    namespace: {
      binary(x, y) {
        return x + y;
      }
    }
  },
  json(input) {
    return input.x + 20;
  },
  throw(a) {
    throw new Error("Exception!");
  },
  chainAdder1(x) {
    return {
      chainAdder2(y) {
        return x + y;
      }
    };
  },
  infer(_bool, _num, _str) {
    return {
      _bool,
      _num,
      _str
    };
  },
  promiseToAdd(x, y) {
    return Promise.resolve(x + y);
  },
  functionOnPromise(x, y) {
    return Promise.resolve({
      adder(z) {
        return x + y + z;
      }
    });
  },
  defaultFunction(x, y) {
    return {
      index() {
        return x + y;
      }
    };
  },
  funcWithContext(x, y, context) {
    if (!context.isContext()) {
      throw new Error("Invalid invocation of funcWithContext()");
    }
    return x + y;
  },
  funcWithPrependedContext(context, x, y) {
    return x + y;
  },
  overrideResponse(context, x, y) {
    const { res } = context;
    context.handled = true;
    context.ctx.status = 200;
    context.ctx.body = `${x * y}`;
    return x + y;
  },
  customContext(context, x, y) {
    return context.z + x + y;
  },
  rawHandler(x, y) {
    return (ctx, next) => {
      ctx.status = 200;
      ctx.body = `${x * y}`;
    };
  }
};

function makeApp(options) {
  const _app = new koa();
  _app.use(bodyParser());
  _app.use(nsoap(routes, options));
  return _app.listen();
}

//app.get("/about", (req, res) => res.send("Hello"))

describe("NSOAP Koa", () => {
  it("Calls a parameter-less function", async () => {
    const app = makeApp();
    const resp = await request(app).get("/about");
    resp.text.should.equal("NSOAP Test Suite");
  });

  it("Gets the value of a property", async () => {
    const app = makeApp();
    const resp = await request(app).get("/static");
    resp.text.should.equal("NSOAP Static File");
  });

  it("Calls a unary function", async () => {
    const app = makeApp();
    const resp = await request(app).get("/unary(10)");
    resp.body.should.equal(20);
  });

  it("Throws an exception", async () => {
    const app = makeApp();
    const resp = await request(app).get("/throw(10)");
    resp.status.should.equal(400);
    resp.error.should.not.be.empty();
  });

  it("Calls a binary function", async () => {
    const app = makeApp();
    const resp = await request(app).get("/binary(10,20)");
    resp.body.should.equal(30);
  });

  it("Calls a unary function with variables", async () => {
    const app = makeApp();
    const resp = await request(app).get("/unary(x)?x=20");
    resp.body.should.equal(30);
  });

  it("Calls a binary function with variables", async () => {
    const app = makeApp();
    const resp = await request(app).get("/binary(x,y)?x=10&y=20");
    resp.body.should.equal(30);
  });

  it("Calls a binary function with literals and variables", async () => {
    const app = makeApp();
    const resp = await request(app).get("/binary(x,20)?x=10");
    resp.body.should.equal(30);
  });

  it("Calls a binary function in a namespace", async () => {
    const app = makeApp();
    const resp = await request(app).get("/namespace.binary(10,20)");
    resp.body.should.equal(30);
  });

  it("Calls a binary function in a nested namespace", async () => {
    const app = makeApp();
    const resp = await request(app).get("/nested.namespace.binary(10,20)");
    resp.body.should.equal(30);
  });

  it("Accepts stringified JSON arguments in querystring", async () => {
    const app = makeApp();
    const obj = encodeURIComponent(JSON.stringify({ x: 10 }));
    const resp = await request(app).get(`/json(obj)?obj=${obj}`);
    resp.body.should.equal(30);
  });

  it("Accepts JSON arguments in body", async () => {
    const app = makeApp();
    const resp = await request(app).post("/json(obj)").send({ obj: { x: 10 } });
    resp.body.should.equal(30);
  });

  it("Accepts arguments in headers", async () => {
    const app = makeApp();
    const resp = await request(app)
      .post("/binary(x,y)")
      .set("x", 10)
      .set("y", 20);
    resp.body.should.equal(30);
  });

  it("Accepts arguments in cookies", async () => {
    const app = makeApp();
    const resp = await request(app)
      .post("/binary(x,y)")
      .set('Cookie', ['x=10', 'y=20'])
    resp.body.should.equal(30);
  });

  it("Obeys parameter precedence (header, query, body, cookies)", async () => {
    const app = makeApp();
    const resp = await request(app)
      .post("/tripletAdder(x,y,z)?x=2&y=20")
      .set("x", 1)
      .set('Cookie', ['x=4', 'y=40', 'z=400'])
      .send({ x: 3, y: 30, z: 300 })
    resp.body.should.equal(321);
  });

  it("Adds parenthesis if omitted", async () => {
    const app = makeApp();
    const resp = await request(app).get("/about");
    resp.text.should.equal("NSOAP Test Suite");
  });

  it("Calls the default function", async () => {
    const app = makeApp();
    const resp = await request(app).get("/");
    resp.text.should.equal("Home page!");
  });

  it("Calls chained functions", async () => {
    const app = makeApp();
    const resp = await request(app).get("/chainAdder1(10).chainAdder2(20)");
    resp.body.should.equal(30);
  });

  it("Infers types", async () => {
    const app = makeApp();
    const resp = await request(app).get("/infer(true,20,Hello)");
    resp.body._bool.should.equal(true);
    resp.body._num.should.equal(20);
    resp.body._str.should.equal("Hello");
  });

  it("Is Case-sensitive", async () => {
    const app = makeApp();
    const resp = await request(app)
      .post("/json(obj)")
      .send({ obj: { X: 100, x: 10 } });
    resp.body.should.equal(30);
  });

  it("Resolves a Promise", async () => {
    const app = makeApp();
    const resp = await request(app).get("/promiseToAdd(10,20)");
    resp.body.should.equal(30);
  });

  it("Calls a function on the resolved value of a Promise", async () => {
    const app = makeApp();
    const resp = await request(app).get(
      "/functionOnPromise(x,y).adder(100)?x=10&y=20"
    );
    resp.body.should.equal(130);
  });

  it("Calls default function on object", async () => {
    const app = makeApp();
    const resp = await request(app).get("/defaultFunction(10,20)");
    resp.body.should.equal(30);
  });

  it("Passes context as an argument", async () => {
    const app = makeApp({ appendContext: true });
    const resp = await request(app).get("/funcWithContext(10,20)");
    resp.body.should.equal(30);
  });

  it("Passes context as the first argument", async () => {
    const app = makeApp({ appendContext: true, contextAsFirstArgument: true });
    const resp = await request(app).get("/funcWithPrependedContext(10,20)");
    resp.body.should.equal(30);
  });

  it("Overrides request handling", async () => {
    const app = makeApp({ appendContext: true, contextAsFirstArgument: true });
    const resp = await request(app).get("/overrideResponse(10,20)");
    resp.text.should.equal("200");
  });

  it("Passes a custom context", async () => {
    const app = makeApp({
      appendContext: true,
      contextAsFirstArgument: true,
      createContext: args => ({ ...args, z: 10 })
    });
    const resp = await request(app).get("/customContext(10,20)");
    resp.body.should.equal(40);
  });

  it("Calls a raw handler", async () => {
    const app = makeApp();
    const resp = await request(app).get("/rawHandler(10,20)");
    resp.text.should.equal("200");
  });

  it("Returns 404 if not found", async () => {
    const app = makeApp();
    const resp = await request(app).get("/nonExistantFunction(10,20)");
    resp.status.should.equal(404);
    resp.text.should.equal("Not found.");
  });
});
