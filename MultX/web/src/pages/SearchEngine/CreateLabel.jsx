import "../../scss/pages/SearchEngine/createLabel.scss";

const CreateLabel = ({ visible, modalRef, handleInput, inputValue, handleAddLabelClick, handleCancelClick }) => {
    return (
        <div className={`createLabel ${visible ? "" : "hidden"}`} ref={modalRef}>
            <p>Create Label</p>
            <input className="createLabel-input" placeholder="Enter new label here" type="text" value={inputValue} onChange={handleInput} maxLength={16} />
            <div className="createLabel-buttons">
                <button className="cancel-btn btn" onClick={handleCancelClick}>Cancel</button>
                <button className="primary-btn btn" onClick={handleAddLabelClick}>Add Label</button>
            </div>
        </div>
    )
}

export default CreateLabel
