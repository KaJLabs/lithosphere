import { Link } from 'react-router-dom';
import { CopyableValue } from './ExplorerUI';
import { useDotLithoName } from '../../hooks/useDotLithoName';

/**
 * Renders a 0x... address with its `.litho` reverse-resolved name (when set)
 * as a small link badge above the copyable address. Falls back to a bare
 * CopyableValue when no reverse record exists.
 *
 * Props:
 *   - address: 0x-hex string (required)
 *   - preserve: forwarded to CopyableValue (default true to preserve casing)
 *   - linkName: if true (default), the .litho name links to /names/<name>
 */
export const AddressWithName = ({ address, preserve = true, linkName = true }) => {
  const name = useDotLithoName(address);

  if (!address) return <span>--</span>;

  if (!name) {
    return <CopyableValue value={address} preserve={preserve} />;
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      {linkName ? (
        <Link
          to={`/names/${name}`}
          style={{
            color: '#0b85ff',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {name}
        </Link>
      ) : (
        <span style={{ color: '#0b85ff', fontSize: 12, fontWeight: 600 }}>{name}</span>
      )}
      <CopyableValue value={address} preserve={preserve} />
    </span>
  );
};

export default AddressWithName;
