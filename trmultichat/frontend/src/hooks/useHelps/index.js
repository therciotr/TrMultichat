import api from "../../services/api";

const usePlans = () => {

    const findAll = async (params) => {
        const { data } = await api.request({
            url: `/helps`,
            method: 'GET',
            params
        });
        return data;
    }

    const list = async (params) => {
        const { data } = await api.request({
            // Ajustado para usar o endpoint principal de helps,
            // evitando 404 em /helps/list na API.
            url: '/helps',
            method: 'GET',
            params
        });
        return data;
    }

    const save = async (data) => {
        const isForm = typeof FormData !== "undefined" && data instanceof FormData;
        const { data: responseData } = await api.request({
            url: '/helps',
            method: 'POST',
            data,
            headers: isForm ? {} : undefined
        });
        return responseData;
    }

    const update = async (data) => {
        const id = data?.id;
        const isForm = typeof FormData !== "undefined" && data instanceof FormData;
        const { data: responseData } = await api.request({
            url: `/helps/${id}`,
            method: 'PUT',
            data,
            headers: isForm ? {} : undefined
        });
        return responseData;
    }

    const remove = async (id) => {
        const { data } = await api.request({
            url: `/helps/${id}`,
            method: 'DELETE'
        });
        return data;
    }

    return {
        findAll,
        list,
        save,
        update,
        remove
    }
}

export default usePlans;