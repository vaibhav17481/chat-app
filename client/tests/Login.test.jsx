import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoginUser,
  mockVerifyEmail,
  mockResendVerificationCode,
  mockNavigate,
  mockSetUser,
  mockSetAccessToken,
} = vi.hoisted(() => ({
  mockLoginUser: vi.fn(),
  mockVerifyEmail: vi.fn(),
  mockResendVerificationCode: vi.fn(),
  mockNavigate: vi.fn(),
  mockSetUser: vi.fn(),
  mockSetAccessToken: vi.fn(),
}));

vi.mock("../src/services/auth.service", () => ({
  loginUser: mockLoginUser,
  verifyEmail: mockVerifyEmail,
  resendVerificationCode: mockResendVerificationCode,
}));

vi.mock("../src/services/api", () => ({
  setAccessToken: mockSetAccessToken,
}));

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ setUser: mockSetUser }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, useNavigate: () => mockNavigate };
});

import Login from "../src/pages/Login";

const apiError = (status, data) => {
  const error = new Error("Request failed with status code " + status);

  error.response = { status, data };

  return error;
};

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

const fillCredentials = () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: "password123" },
  });
};

const submitLogin = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();

  mockLoginUser.mockReset();
  mockVerifyEmail.mockReset();
  mockResendVerificationCode.mockReset();
  mockNavigate.mockReset();
  mockSetUser.mockReset();
  mockSetAccessToken.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Login - automatic verification code", () => {
  it("opens the verification panel and tells the user a code was sent", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message:
          "Please verify your email. We sent a 6-digit code to your email address.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    expect(mockLoginUser).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/we sent a 6-digit verification code/i)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("123456")).toBeInTheDocument();

    // The resend button is locked while the cooldown runs.
    const resendButton = screen.getByRole("button", { name: /resend otp/i });
    expect(resendButton).toBeDisabled();
    expect(resendButton).toHaveTextContent(/resend otp in 30s/i);
  });

  it("does not claim that a code was sent when the server reused an existing one", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message:
          "Please verify your email. A verification code was already sent to your email address.",
        requiresVerification: true,
        codeSent: false,
        cooldownRemaining: 12,
      })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    expect(
      screen.getByText(/a verification code was already sent/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend otp/i })
    ).toHaveTextContent(/resend otp in 12s/i);
  });

  it("only issues one login request when the button is pressed twice", async () => {
    let resolveLogin;

    mockLoginUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderLogin();
    fillCredentials();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });

    expect(mockLoginUser).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLogin({
        token: "jwt-token",
        user: { id: 1, email: "user@example.com" },
      });
    });
  });

  it("logs the user in when the account is already verified", async () => {
    mockLoginUser.mockResolvedValue({
      token: "jwt-token",
      user: { id: 1, email: "user@example.com" },
    });

    renderLogin();
    fillCredentials();
    await submitLogin();

    expect(mockSetAccessToken).toHaveBeenCalledWith("jwt-token");
    // The token is kept in memory, never in localStorage.
    expect(localStorage.getItem("token")).toBeNull();
    expect(mockSetUser).toHaveBeenCalledWith({
      id: 1,
      email: "user@example.com",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/home");
    expect(
      screen.queryByPlaceholderText("123456")
    ).not.toBeInTheDocument();
  });

  it("can open the panel manually and then request a code", async () => {
    mockResendVerificationCode.mockResolvedValue({
      message: "A new verification code has been sent to your email.",
      cooldownRemaining: 30,
    });

    renderLogin();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /verify your email/i }));
    });

    expect(
      screen.getByText(/no code requested yet/i)
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "user@example.com" },
      });
    });

    // The panel stays open while the address is typed.
    expect(screen.getByPlaceholderText("123456")).toBeInTheDocument();

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    expect(resendButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(mockResendVerificationCode).toHaveBeenCalledWith({
      email: "user@example.com",
    });
    expect(resendButton).toBeDisabled();
  });

  it("shows the server message when the credentials are wrong", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(400, { message: "Invalid email or password" })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a fallback message when the request fails completely", async () => {
    mockLoginUser.mockRejectedValue(new Error("Network Error"));

    renderLogin();
    fillCredentials();
    await submitLogin();

    expect(screen.getByText(/login failed/i)).toBeInTheDocument();
  });
});

describe("Login - resend cooldown", () => {
  it("enables the resend button once the countdown reaches zero", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    expect(resendButton).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(resendButton).not.toBeDisabled();
    expect(resendButton).toHaveTextContent(/^resend otp$/i);
  });

  it("restarts the countdown after a successful resend", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    mockResendVerificationCode.mockResolvedValue({
      message: "A new verification code has been sent to your email.",
      cooldownRemaining: 30,
    });

    renderLogin();
    fillCredentials();
    await submitLogin();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    expect(resendButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(mockResendVerificationCode).toHaveBeenCalledTimes(1);
    expect(resendButton).toBeDisabled();
    expect(resendButton).toHaveTextContent(/resend otp in 30s/i);
    expect(
      screen.getByText(/a new verification code has been sent/i)
    ).toBeInTheDocument();
  });

  it("cannot bypass the cooldown because the button stays disabled", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(mockResendVerificationCode).not.toHaveBeenCalled();
  });

  it("adopts the cooldown reported by the server when a resend is rejected", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    mockResendVerificationCode.mockRejectedValue(
      apiError(429, {
        message: "Please wait 12 second(s) before requesting another verification code.",
        retryAfter: 12,
      })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /resend otp/i }));
    });

    expect(
      screen.getByText(/please wait 12 second/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend otp/i })
    ).toHaveTextContent(/resend otp in 12s/i);
  });
});

describe("Login - verification", () => {
  it("verifies the code and tells the user to sign in", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    mockVerifyEmail.mockResolvedValue({
      message: "Email verified successfully",
    });

    renderLogin();
    fillCredentials();
    await submitLogin();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("123456"), {
        target: { value: "123456" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /verify email/i }));
    });

    expect(mockVerifyEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      code: "123456",
    });
    expect(
      screen.getByText(/email verified successfully/i)
    ).toBeInTheDocument();
  });

  it("keeps a leading zero in the submitted code", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    mockVerifyEmail.mockResolvedValue({ message: "Email verified successfully" });

    renderLogin();
    fillCredentials();
    await submitLogin();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("123456"), {
        target: { value: "012345" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /verify email/i }));
    });

    expect(mockVerifyEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      code: "012345",
    });
  });

  it("shows the server error when the code is wrong", async () => {
    mockLoginUser.mockRejectedValue(
      apiError(403, {
        message: "Please verify your email.",
        requiresVerification: true,
        codeSent: true,
        cooldownRemaining: 30,
      })
    );

    mockVerifyEmail.mockRejectedValue(
      apiError(400, { message: "Invalid verification code" })
    );

    renderLogin();
    fillCredentials();
    await submitLogin();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("123456"), {
        target: { value: "111111" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /verify email/i }));
    });

    expect(screen.getByText("Invalid verification code")).toBeInTheDocument();
  });
});
