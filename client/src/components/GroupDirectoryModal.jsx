import PropTypes from 'prop-types';
import UserPicker from './UserPicker';

const statusLabel = (status) => {
  switch (status) {
    case 'owner':
      return 'владелец';
    case 'admin':
      return 'администратор';
    case 'member':
      return 'участник';
    case 'pending':
      return 'заявка отправлена';
    default:
      return 'можно присоединиться';
  }
};

const GroupDirectoryModal = ({
  isOpen,
  onClose,
  isAdmin,
  users,
  groups,
  loading,
  selectedIds,
  onChangeSelected,
  onCreateGroup,
  onRequestJoin,
  onOpenChat,
  onManage,
  groupTitle,
  onTitleChange,
  currentUserId,
  onConfirm,
  onBack,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header modal__header--with-back">
          <div className="header-actions">
            {onBack && (
              <button type="button" className="secondary-btn" onClick={onBack}>
                Назад
              </button>
            )}
            <h3>Групповые чаты</h3>
          </div>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
        {loading && <p className="muted">Загрузка групп...</p>}
        {!loading && (
          <div className="modal-body-scroll">
            {isAdmin ? (
              <div className="group-grid">
                <div className="group-column">
                  <h4>Создать группу</h4>
                  <label className="field">
                    Название группы
                    <input
                      type="text"
                      className="field-input"
                      value={groupTitle}
                      onChange={(e) => onTitleChange(e.target.value)}
                    />
                  </label>
                  <UserPicker
                    mode="multi"
                    users={users}
                    selectedIds={selectedIds}
                    onChange={onChangeSelected}
                    excludeIds={[currentUserId]}
                  />
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() =>
                      onConfirm(`Вы действительно хотите создать группу "${groupTitle}"?`, onCreateGroup)
                    }
                    disabled={!groupTitle.trim()}
                  >
                    Создать группу
                  </button>
                </div>
                <div className="group-column">
                  <h4>Список групп</h4>
                  <div className="group-list">
                    {groups.map((group) => (
                      <div key={group.id} className="group-card">
                        <div>
                          <div className="group-card__title">{group.title}</div>
                          <div className="group-card__meta">Участников: {group.participantsCount}</div>
                          <div className="group-card__meta">Статус: {statusLabel(group.membershipStatus)}</div>
                        </div>
                        <div className="btn-row">
                          {(group.membershipStatus === 'member' ||
                            group.membershipStatus === 'admin' ||
                            group.membershipStatus === 'owner') && (
                            <button type="button" className="primary-btn" onClick={() => onOpenChat(group.id)}>
                              Открыть
                            </button>
                          )}
                          {(isAdmin ||
                            group.membershipStatus === 'admin' ||
                            group.membershipStatus === 'owner') && (
                            <button type="button" className="secondary-btn" onClick={() => onManage(group.id)}>
                              Управлять
                            </button>
                          )}
                          {group.membershipStatus === 'none' && !isAdmin && (
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() =>
                                onConfirm(
                                  `Вы хотите подать заявку в группу "${group.title}"?`,
                                  () => onRequestJoin(group)
                                )
                              }
                            >
                              Подать заявку
                            </button>
                          )}
                          {group.membershipStatus === 'pending' && <span className="muted">Заявка отправлена</span>}
                        </div>
                      </div>
                    ))}
                    {!groups.length && <p className="muted">Группы пока не созданы</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="group-list single-column">
                <p className="muted">
                  Создавать группы может только администратор системы. Вы можете подать заявку в доступные группы ниже.
                </p>
                {groups.map((group) => (
                  <div key={group.id} className="group-card">
                    <div>
                      <div className="group-card__title">{group.title}</div>
                      <div className="group-card__meta">Участников: {group.participantsCount}</div>
                      <div className="group-card__meta">Статус: {statusLabel(group.membershipStatus)}</div>
                    </div>
                    <div className="btn-row">
                      {group.membershipStatus === 'member' && (
                        <button type="button" className="primary-btn" onClick={() => onOpenChat(group.id)}>
                          Открыть
                        </button>
                      )}
                      {group.membershipStatus === 'none' && (
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            onConfirm(
                              `Вы хотите подать заявку в группу "${group.title}"?`,
                              () => onRequestJoin(group)
                            )
                          }
                        >
                          Подать заявку
                        </button>
                      )}
                      {group.membershipStatus === 'pending' && (
                        <span className="muted">Заявка отправлена</span>
                      )}
                      {group.membershipStatus === 'member' && (
                        <span className="muted">Вы участник</span>
                      )}
                    </div>
                  </div>
                ))}
                {!groups.length && <p className="muted">Группы пока не созданы</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

GroupDirectoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool,
  selectedIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChangeSelected: PropTypes.func.isRequired,
  onCreateGroup: PropTypes.func.isRequired,
  onRequestJoin: PropTypes.func.isRequired,
  onOpenChat: PropTypes.func.isRequired,
  onManage: PropTypes.func.isRequired,
  groupTitle: PropTypes.string.isRequired,
  onTitleChange: PropTypes.func.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onBack: PropTypes.func,
};

GroupDirectoryModal.defaultProps = {
  loading: false,
  onBack: null,
};

export default GroupDirectoryModal;
