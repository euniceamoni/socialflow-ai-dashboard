# Requirements Document

## Introduction

This feature adds TOTP-based Two-Factor Authentication (2FA) to SocialFlow Desktop, allowing users to secure their accounts using authenticator apps such as Google Authenticator or Authy. The implementation is client-side within the Electron/React app and covers secret generation, QR code display, token verification, and recovery code management. Because SocialFlow is a desktop Electron app with no dedicated backend, TOTP secrets and state are stored locally (encrypted) and verified in-process using a TOTP library.

## Glossary

- **TOTP**: Time-based One-Time Password — a 6-digit code generated from a shared secret and the current time, per RFC 6238.
- **2FA_Manager**: The client-side service responsible for generating TOTP secrets, verifying tokens, and managing recovery codes.
- **QR_Code_Generator**: The component responsible for rendering a QR code image from a TOTP URI.
- **Setup_Wizard**: The UI component that guides the user through enabling 2FA (secret generation → QR scan → token confirmation).
- **Recovery_Code_Store**: The encrypted local store that persists recovery codes for the authenticated user.
- **User_Store**: The existing local store that persists user account state, extended to include `twoFactorSecret` and `twoFactorEnabled` fields.
- **Login_Guard**: The UI gate that challenges the user for a TOTP token or recovery code before granting access when 2FA is enabled.
- **Authenticator App**: A third-party mobile application (e.g., Google Authenticator, Authy) that generates TOTP codes.

---

## Requirements

### Requirement 1: Enable 2FA Setup

**User Story:** As a user, I want to enable TOTP-based 2FA on my account, so that my account is protected by a second factor beyond my password.

#### Acceptance Criteria

1. WHEN the user navigates to the Security section of Settings, THE Setup_Wizard SHALL display an "Enable Two-Factor Authentication" option when `twoFactorEnabled` is `false`.
2. WHEN the user initiates 2FA setup, THE 2FA_Manager SHALL generate a cryptographically random TOTP secret of at least 160 bits (20 bytes).
3. WHEN a TOTP secret is generated, THE QR_Code_Generator SHALL render a QR code encoding a valid `otpauth://totp/` URI containing the account label and the generated secret.
4. WHEN the QR code is displayed, THE Setup_Wizard SHALL also display the raw Base32-encoded secret as a fallback for manual entry into an Authenticator App.
5. WHEN the user submits a 6-digit confirmation token during setup, THE 2FA_Manager SHALL verify the token against the generated secret using a time window of ±1 step (±30 seconds).
6. IF the confirmation token is invalid, THEN THE Setup_Wizard SHALL display an error message and allow the user to re-enter the token without regenerating the secret.
7. WHEN the confirmation token is valid, THE 2FA_Manager SHALL persist the TOTP secret to the User_Store with `twoFactorEnabled` set to `true`.

---

### Requirement 2: Recovery Codes

**User Story:** As a user, I want to receive recovery codes when I enable 2FA, so that I can regain access to my account if I lose my Authenticator App.

#### Acceptance Criteria

1. WHEN 2FA is successfully enabled, THE 2FA_Manager SHALL generate exactly 8 single-use recovery codes, each consisting of 10 alphanumeric characters.
2. WHEN recovery codes are generated, THE Setup_Wizard SHALL display all 8 codes to the user before completing setup.
3. THE Setup_Wizard SHALL require the user to acknowledge that the codes have been saved before dismissing the setup flow.
4. THE Recovery_Code_Store SHALL persist recovery codes in an encrypted form tied to the user's account.
5. WHEN a recovery code is used for authentication, THE 2FA_Manager SHALL mark that code as consumed and SHALL NOT accept it again.
6. IF all recovery codes are consumed, THEN THE Login_Guard SHALL display a message instructing the user to disable and re-enable 2FA to generate new codes.
7. WHILE 2FA is enabled, THE Setup_Wizard SHALL provide an option to regenerate recovery codes, which invalidates all previously issued codes.

---

### Requirement 3: TOTP Verification at Login

**User Story:** As a user, I want to be prompted for my TOTP code when I log in, so that my account cannot be accessed with credentials alone.

#### Acceptance Criteria

1. WHILE `twoFactorEnabled` is `true`, THE Login_Guard SHALL present a 6-digit token input screen after primary credential verification succeeds.
2. WHEN the user submits a 6-digit token, THE 2FA_Manager SHALL verify it against the stored TOTP secret using a time window of ±1 step (±30 seconds).
3. WHEN the token is valid, THE Login_Guard SHALL grant access and navigate the user to the Dashboard.
4. IF the submitted token is invalid, THEN THE Login_Guard SHALL display an error message and increment a failed-attempt counter.
5. IF the failed-attempt counter reaches 5 within a single login session, THEN THE Login_Guard SHALL lock the 2FA input for 5 minutes and display the remaining lockout duration.
6. WHEN the user selects "Use a recovery code", THE Login_Guard SHALL accept a valid unused recovery code in place of a TOTP token and grant access upon successful match.
7. IF a TOTP token has already been used within the current 30-second window, THEN THE 2FA_Manager SHALL reject it to prevent replay attacks.

---

### Requirement 4: Disable 2FA

**User Story:** As a user, I want to disable 2FA on my account, so that I can remove the second factor if I no longer need it.

#### Acceptance Criteria

1. WHILE `twoFactorEnabled` is `true`, THE Setup_Wizard SHALL display a "Disable Two-Factor Authentication" option in the Security section of Settings.
2. WHEN the user initiates 2FA disablement, THE Login_Guard SHALL require the user to provide a valid current TOTP token or a valid recovery code before proceeding.
3. WHEN the provided token or recovery code is valid, THE 2FA_Manager SHALL set `twoFactorEnabled` to `false`, remove the stored TOTP secret, and invalidate all recovery codes.
4. IF the provided token or recovery code is invalid, THEN THE Setup_Wizard SHALL display an error and SHALL NOT disable 2FA.

---

### Requirement 5: TOTP Secret and Recovery Code Storage Security

**User Story:** As a user, I want my TOTP secret and recovery codes stored securely, so that a compromise of local storage does not directly expose my 2FA credentials.

#### Acceptance Criteria

1. THE User_Store SHALL store the TOTP secret in an encrypted form using AES-256 encryption before writing to disk.
2. THE Recovery_Code_Store SHALL store recovery codes in an encrypted form using AES-256 encryption before writing to disk.
3. THE 2FA_Manager SHALL derive the encryption key from a value that is not stored in plaintext alongside the encrypted data.
4. IF decryption of the stored secret fails, THEN THE 2FA_Manager SHALL treat 2FA as disabled and SHALL log an error without exposing the raw encrypted bytes to the UI.

---

### Requirement 6: QR Code URI Correctness (Round-Trip)

**User Story:** As a developer, I want the generated TOTP URI to be parseable by standard authenticator apps, so that users can scan the QR code without errors.

#### Acceptance Criteria

1. THE QR_Code_Generator SHALL produce a URI conforming to the `otpauth://totp/` scheme as specified by the Google Authenticator Key URI Format.
2. THE 2FA_Manager SHALL include the `issuer` parameter in the URI set to the application name "SocialFlow".
3. FOR ALL generated TOTP secrets, encoding the secret into a URI and then extracting and decoding the secret from that URI SHALL produce the original secret (round-trip property).
4. WHEN the QR code is rendered, THE QR_Code_Generator SHALL use an error correction level of at least "M" (15% recovery capacity) to ensure scannability.
