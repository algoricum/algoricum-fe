const FacebookIcon = ({ color = "#CBD5E0", width = 10, height = 16 }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.23896 16V8.70218H8.68755L9.05491 5.85725H6.23896V4.04118C6.23896 3.21776 6.46667 2.65661 7.64879 2.65661L9.15402 2.65599V0.111384C8.89371 0.0775563 8.00016 0 6.96017 0C4.78849 0 3.30172 1.32557 3.30172 3.75942V5.85725H0.845703V8.70218H3.30172V16H6.23896Z"
        fill={color}
      />
    </svg>
  );
};

export default FacebookIcon;
