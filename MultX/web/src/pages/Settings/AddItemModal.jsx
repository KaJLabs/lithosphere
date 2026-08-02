import { Blur } from '../../components/Blur';
import { useClickOutside } from '../../hooks/useClickOutside';
import '../../scss/pages/Settings/addItemModal.scss';

export const AddItemModal = ({ socialName, setShowModal }) => {
  const modalRef = useClickOutside(() => {
    setShowModal(false);
  });

  return (
    <div className="addItemModal">
      <Blur />

      <div ref={modalRef} className="addItemModal-content">
        <div className="addItemModal-content-title">Add {socialName}</div>

        <div className="addItemModal-content-description">
          Add link to your {socialName}. Only visible to yourself and for further notifications
        </div>

        <textarea name="" rows="2" className="addItemModal-content-input"></textarea>

        <div className="addItemModal-content-btns">
          <button
            className="cancel-btn addItemModal-content-btns-btn"
            onClick={() => setShowModal(false)}>
            Cancel
          </button>
          <button className="primary-btn addItemModal-content-btns-btn">Save</button>
        </div>
      </div>
    </div>
  );
};
