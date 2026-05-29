import { useState, useCallback, useMemo } from "react";

/**
 * Reusable React Hook for multi-step form validation, state management, and accessible error handling.
 *
 * @param {Object} initialValues - The initial fields and values of the form.
 * @param {Object} validationRules - Map of field names to their validation constraints.
 */
export default function useFormValidation(
  initialValues = {},
  validationRules = {}
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  /**
   * Helper function to validate a single field value against its constraints.
   */
  const validateField = useCallback(
    (name, value, rules = {}) => {
      let error = "";

      if (rules.required) {
        if (Array.isArray(value)) {
          if (value.length === 0) {
            error = rules.requiredMessage || "This field is required";
          }
        } else if (typeof value === "object" && value !== null) {
          // e.g. declarations object: all values must be true (or custom behavior)
          const allChecked = Object.values(value).every((v) => !!v);
          if (!allChecked) {
            error = rules.requiredMessage || "Please agree to all declarations";
          }
        } else if (!String(value || "").trim()) {
          error = rules.requiredMessage || "This field is required";
        }
      }

      if (!error && rules.email) {
        const emailStr = String(value || "").trim();
        if (emailStr) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
            error = rules.emailMessage || "Please enter a valid email address";
          }
        }
      }

      if (!error && rules.phone) {
        const phoneStr = String(value || "").trim();
        if (phoneStr && !/^\d{10}$/.test(phoneStr)) {
          error =
            rules.phoneMessage || "Phone number must be exactly 10 digits";
        }
      }

      if (!error && rules.minLength) {
        const strVal = String(value || "");
        if (strVal && strVal.length < rules.minLength) {
          error =
            rules.minLengthMessage ||
            `Minimum length is ${rules.minLength} characters`;
        }
      }

      if (!error && rules.maxLength) {
        const strVal = String(value || "");
        if (strVal && strVal.length > rules.maxLength) {
          error =
            rules.maxLengthMessage ||
            `Maximum length is ${rules.maxLength} characters`;
        }
      }

      if (!error && rules.url) {
        const urlStr = String(value || "").trim();
        if (urlStr) {
          try {
            new URL(urlStr);
          } catch {
            error =
              rules.urlMessage ||
              "Please enter a valid URL (e.g. https://example.com)";
          }
        }
      }

      if (!error && rules.custom) {
        error = rules.custom(value, values) || "";
      }

      return error;
    },
    [values]
  );

  /**
   * Universal change handler that updates the value and validates the field dynamically.
   */
  const handleChange = useCallback(
    (name, value) => {
      setValues((prev) => {
        const nextValues = { ...prev, [name]: value };

        // Re-validate field on the fly if it has already been touched or had an error
        if (touched[name] || errors[name]) {
          const rules = validationRules[name];
          if (rules) {
            // Note: we pass the updated nextValues to validateField so co-dependent rules have fresh state
            const error = validateField(name, value, rules);
            setErrors((prevErrors) => {
              const nextErrors = { ...prevErrors };
              if (error) {
                nextErrors[name] = error;
              } else {
                delete nextErrors[name];
              }
              return nextErrors;
            });
          }
        }

        return nextValues;
      });
    },
    [validationRules, validateField, touched, errors]
  );

  /**
   * Universal blur handler that marks a field as touched and validates it.
   */
  const handleBlur = useCallback(
    (name) => {
      setTouched((prev) => {
        if (prev[name]) return prev;
        return { ...prev, [name]: true };
      });

      const rules = validationRules[name];
      if (rules) {
        const val = values[name];
        const error = validateField(name, val, rules);
        setErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[name] = error;
          } else {
            delete next[name];
          }
          return next;
        });
      }
    },
    [values, validationRules, validateField]
  );

  /**
   * Run validation on a specific set of fields (for multi-step) or the entire form.
   *
   * @param {Array|null} fieldsToValidate - Specific fields to check. If null, validates all.
   * @returns {boolean} Whether the fields/form are valid.
   */
  const validateForm = useCallback(
    (fieldsToValidate = null) => {
      const targets = fieldsToValidate || Object.keys(validationRules);
      const newErrors = {};
      const newTouched = {};

      targets.forEach((name) => {
        newTouched[name] = true;
        const rules = validationRules[name];
        if (rules) {
          const val = values[name];
          const error = validateField(name, val, rules);
          if (error) {
            newErrors[name] = error;
          }
        }
      });

      setTouched((prev) => ({ ...prev, ...newTouched }));
      setErrors((prev) => {
        const next = fieldsToValidate ? { ...prev } : {};
        targets.forEach((name) => {
          if (newErrors[name]) {
            next[name] = newErrors[name];
          } else {
            delete next[name];
          }
        });
        return next;
      });

      return Object.keys(newErrors).length === 0;
    },
    [values, validationRules, validateField]
  );

  /**
   * Reset form values and clear error/touched tracking states.
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  /**
   * Form-wide validation state check.
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    isValid,
    setValues,
    setErrors,
    setTouched,
  };
}
