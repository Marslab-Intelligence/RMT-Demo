import React from 'react';
import GlassDatePicker from './GlassDatePicker';

export default function IndianDateInput({ value, onChange, className = '', placeholder = 'DD/MM/YYYY', size = 'md', ...props }) {
  return (
    <GlassDatePicker
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      outputFormat="YYYY-MM-DD"
      size={size}
      {...props}
    />
  );
}
