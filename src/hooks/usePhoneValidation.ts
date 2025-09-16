import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import { useState } from "react";

export const usePhoneValidation = () => {
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");

  const validatePhoneNumber = (phone: string | undefined): boolean => {
    if (!phone) {
      setPhoneError("Phone number is required");
      return false;
    }

    try {
      if (!isValidPhoneNumber(phone)) {
        setPhoneError("Please enter a valid phone number");
        return false;
      }

      const phoneNumberObj = parsePhoneNumber(phone);
      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        setPhoneError("Invalid phone number for the selected country");
        return false;
      }

      setPhoneError("");
      return true;
    } catch {
      setPhoneError("Invalid phone number format");
      return false;
    }
  };

  const handlePhoneChange = (value: string | undefined) => {
    setPhoneNumber(value || "");
    if (value) {
      validatePhoneNumber(value);
    } else {
      setPhoneError("");
    }
  };

  const handlePhoneBlur = () => {
    validatePhoneNumber(phoneNumber);
  };

  return {
    phoneNumber,
    setPhoneNumber,
    phoneError,
    validatePhoneNumber,
    handlePhoneChange,
    handlePhoneBlur,
    resetPhone: () => {
      setPhoneNumber("");
      setPhoneError("");
    },
  };
};
