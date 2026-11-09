import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyEmail, mockResendVerificationCode, mockNavigate } = vi.hoisted(
  () => ({
    mockVerifyEmail: vi.fn(),
    mockResendVerificationCode: vi.fn(),
    mockNavigate: vi.fn(),
  })
);

vi.mock("../src/services/auth.service", () => ({
  verifyEmail: mockVerifyEmail,
  resendVerificationCode: mockResendVerificationCode,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, useNavigate: () => mockNavigate };
});

import VerifyEmail from "../src/pages/VerifyEmail";

const apiError = (status, data) => {
  const error = new Error("Request failed with status code " + status);

  error.response = { status, data };

  return error;
};

const renderVerifyEmail = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/verify-email", state }]}>
      <VerifyEmail />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.useFakeTimers();

  mockVerifyEmail.mockReset();
  mockResendVerificationCode.mockReset();
  mockNavigate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("VerifyEmail", () => {
  it("locks the resend button when a code was just mailed at registration", () => {
    renderVerifyEmail({ email: "user@example.com", cooldownRemaining: 30 });

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    expect(resendButton).toBeDisabled();
    expect(resendButton).toHaveTextContent(/resend otp in 30s/i);
  });

  it("unlocks the resend button once the countdown is over", async () => {
    renderVerifyEmail({ email: "user@example.com", cooldownRemaining: 30 });

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(resendButton).not.toBeDisabled();
  });

  it("starts the countdown again after a successful resend", async () => {
    mockResendVerificationCode.mockResolvedValue({
      message: "A new verification code has been sent to your email.",
      cooldownRemaining: 30,
    });

    renderVerifyEmail({ email: "user@example.com", cooldownRemaining: 30 });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    const resendButton = screen.getByRole("button", { name: /resend otp/i });

    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(mockResendVerificationCode).toHaveBeenCalledWith({
      email: "user@example.com",
    });
    expect(resendButton).toBeDisabled();
    expect(resendButton).toHaveTextContent(/resend otp in 30s/i);
  });

  it("adopts the cooldown the server asks for when a resend is rejected", async () => {
    mockResendVerificationCode.mockRejectedValue(
      apiError(429, {
        message: "Please wait 9 second(s) before requesting another verification code.",
        retryAfter: 9,
      })
    );

    renderVerifyEmail({ email: "user@example.com" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /resend otp/i }));
    });

    expect(
      screen.getByText(/please wait 9 second/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend otp/i })
    ).toHaveTextContent(/resend otp in 9s/i);
  });

  it("verifies the code and returns to the login page", async () => {
    mockVerifyEmail.mockResolvedValue({ message: "Email verified successfully" });

    renderVerifyEmail({ email: "user@example.com", cooldownRemaining: 30 });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/verification code/i), {
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
      screen.getByText("Email verified successfully")
    ).toBeInTheDocument();
  });

  it("refuses to submit an incomplete code", async () => {
    renderVerifyEmail({ email: "user@example.com", cooldownRemaining: 30 });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: "123" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /verify email/i }));
    });

    expect(mockVerifyEmail).not.toHaveBeenCalled();
    expect(
      screen.getByText(/enter your email and a valid 6-digit code/i)
    ).toBeInTheDocument();
  });
});
