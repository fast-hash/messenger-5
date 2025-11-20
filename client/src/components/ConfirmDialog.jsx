import PropTypes from 'prop-types';

const ConfirmDialog = ({ text, onConfirm, onCancel }) => (
  <div className="modal-backdrop" onClick={onCancel}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal__header">
        <h3>Подтверждение</h3>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          Закрыть
        </button>
      </div>
      <p>{text}</p>
      <div className="choice-buttons">
        <button type="button" className="primary-btn" onClick={onConfirm}>
          Да
        </button>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          Нет
        </button>
      </div>
    </div>
  </div>
);

ConfirmDialog.propTypes = {
  text: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDialog;
