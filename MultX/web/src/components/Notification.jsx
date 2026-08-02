import { useContext } from 'react'
import { NotificationContext } from '../context';

import TickIcon from '../assets/icons/tick.svg?react';
import RefreshIcon from '../assets/icons/refresh.svg?react';
import CloseIcon from '../assets/icons/notification-close.svg?react';

import "../scss/components/notification.scss";

const notificationTypes = [
    {
        type: "copy",
        label: "Copied to the clipboard",
        backgroundColor: "#25a50e",
        Icon: TickIcon
    },
    {
        type: "refresh",
        label: "Refreshed",
        backgroundColor: "#25a50e",
        Icon: RefreshIcon
    }
]

const RenderNotification = ({ notificationTypeIndex }) => {
    const { label, backgroundColor, Icon } = notificationTypeIndex >= 0 && notificationTypes[notificationTypeIndex];
    const { setNotification } = useContext(NotificationContext);

    return (
        <div className="notification-wrap" style={{ backgroundColor: notificationTypeIndex >= 0 && backgroundColor }}>
            <div className="notification-wrap-btn">
                <div className="layer1">
                    <div className="layer2">
                        {notificationTypeIndex >= 0 && <Icon />}
                    </div>
                </div>
            </div>
            <p>{notificationTypeIndex >= 0 && label}</p>
            <CloseIcon className="notification-wrap-close" onClick={() => setNotification("")}/>
        </div>
    )
}

const Notification = ({ notification }) => {
    const hidden = notification.length === 0;
    const notificationTypeIndex = notificationTypes.findIndex((a) => a.type === notification);

    return (
        <div className={`notification ${hidden ? "hidden" : ""}`}>
            <RenderNotification notificationTypeIndex={notificationTypeIndex} />
        </div>
    )
}

export default Notification
