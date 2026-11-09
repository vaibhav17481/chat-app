import { beforeEach, describe, expect, it, vi } from "vitest";

const { post, get, requestInterceptors, responseInterceptors } = vi.hoisted(
  () => ({
    post: vi.fn(),
    get: vi.fn(),
    requestInterceptors: [],
    responseInterceptors: [],
  })
);

vi.mock("axios", () => {
  const instance = vi.fn((config) => {
    if (config && config.method === "post") {
      return post(config.url, config.data);
    }

    return get(config.url, config);
  });

  instance.post = post;
  instance.get = get;
  instance.defaults = {};
  instance.interceptors = {
    request: {
      use: (fn) => requestInterceptors.push(fn),
    },
    response: {
      use: (fulfilled, rejected) => responseInterceptors.push(rejected),
    },
  };

  const axios = vi.fn(() => instance);

  axios.create = vi.fn(() => instance);
  axios.post = post;
  axios.get = get;

  return { default: axios };
});

const { setAccessToken, getAccessToken, setSessionExpiredHandler } =
  await import("../src/services/api");

const makeError = (status, config) => {
  const error = new Error("Request failed with status code " + status);

  error.response = { status };
  error.config = config;

  return error;
};

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  setAccessToken(null);
  setSessionExpiredHandler(null);
});

describe("access token storage", () => {
  it("keeps the token in memory only", () => {
    setAccessToken("token-123");

    expect(getAccessToken()).toBe("token-123");
    expect(localStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
  });

  it("forgets the token when it is cleared", () => {
    setAccessToken("token-123");
    setAccessToken(null);

    expect(getAccessToken()).toBeNull();
  });

  it("attaches the token to every request", () => {
    setAccessToken("token-123");

    const config = requestInterceptors[0]({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-123");
  });

  it("sends no authorization header when there is no token", () => {
    const config = requestInterceptors[0]({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("expired access token", () => {
  it("renews the session and replays the request", async () => {
    post.mockResolvedValue({ data: { token: "fresh-token" } });
    get.mockResolvedValue({ data: { email: "user@example.com" } });

    const original = { url: "/users/profile", headers: {} };

    const result = await responseInterceptors[0](
      makeError(401, original)
    );

    expect(post).toHaveBeenCalledWith("/auth/refresh");
    expect(getAccessToken()).toBe("fresh-token");
    expect(get).toHaveBeenCalledWith("/users/profile", original);
    expect(result.data.email).toBe("user@example.com");
  });

  it("renews the session only once for a burst of failed requests", async () => {
    post.mockResolvedValue({ data: { token: "fresh-token" } });
    get.mockResolvedValue({ data: {} });

    const first = responseInterceptors[0](
      makeError(401, { url: "/users/profile", headers: {} })
    );
    const second = responseInterceptors[0](
      makeError(401, { url: "/users/profile", headers: {} })
    );

    await Promise.all([first, second]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("ends the session when the refresh token is not accepted", async () => {
    const expired = vi.fn();

    setSessionExpiredHandler(expired);

    post.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      responseInterceptors[0](
        makeError(401, { url: "/users/profile", headers: {} })
      )
    ).rejects.toBeTruthy();

    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("does not try to refresh the session for the auth routes", async () => {
    await expect(
      responseInterceptors[0](
        makeError(401, { url: "/auth/refresh", headers: {} })
      )
    ).rejects.toBeTruthy();

    expect(post).not.toHaveBeenCalled();
  });

  it("does not retry the same request twice", async () => {
    post.mockResolvedValue({ data: { token: "fresh-token" } });
    get.mockRejectedValue(makeError(401, { url: "/users/profile", headers: {} }));

    const original = { url: "/users/profile", headers: {} };

    await expect(
      responseInterceptors[0](makeError(401, original))
    ).rejects.toBeTruthy();

    expect(get).toHaveBeenCalledTimes(1);
    expect(original.retried).toBe(true);
  });
});
