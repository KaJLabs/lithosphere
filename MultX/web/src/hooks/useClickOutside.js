import { useEffect, useRef } from "react";

export const useClickOutside = (handler) => {
    let domNode = useRef();

    useEffect(() => {
        let fn = (event) => {
            if (!domNode.current?.contains(event.target)) {
                handler();
            }
        }

        document.addEventListener("mousedown", fn);

        return () => {
            document.removeEventListener("mousedown", fn);
        }
    })

    return domNode;
}